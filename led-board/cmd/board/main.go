// Command board shows live departures for one station, or a built-in example,
// on the LED matrix, or on a desktop window or PNG files for debugging.
//
// Settings come from a TOML config file, BOARD_* environment variables and
// flags, each overriding the last; see config.go.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"slices"
	"strings"
	"syscall"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/formats"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/live"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix/pngdisplay"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/setupdisplay"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/windowdisplay"
)

func main() {
	fs := flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	configPath := addFlags(fs)
	schema := fs.Bool("config-schema", false, "print the configuration schema as JSON and exit")
	check := fs.Bool("check-config", false, "validate the configuration without opening the display")
	setupStatus := fs.String("setup-status", "", "network status JSON for the unconfigured board's setup display")
	fs.Parse(os.Args[1:])
	if *schema {
		json.NewEncoder(os.Stdout).Encode(describeConfig(fs))
		return
	}

	v, err := configure(fs, *configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	cfg, err := load(v)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := validateConfig(cfg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	setup := cfg.CRS == "" && cfg.Fixture == "" && *setupStatus != ""
	var fixture []model.View
	if cfg.Fixture != "" {
		if fixture = fixtures.Steps(cfg.Fixture); fixture == nil {
			fmt.Fprintf(os.Stderr, "unknown fixture %q; want one of %s\n", cfg.Fixture, strings.Join(fixtures.Names, ", "))
			os.Exit(2)
		}
	} else if cfg.CRS == "" && !setup && !*check {
		fmt.Fprintln(os.Stderr, "crs is required unless fixture is set: set it in the config file, BOARD_CRS, or -crs")
		fs.Usage()
		os.Exit(2)
	}

	level := slog.LevelInfo
	if cfg.Verbose {
		level = slog.LevelDebug
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))
	if file := v.ConfigFileUsed(); file != "" {
		logger.Info("using config file", "path", file)
	}
	logger.Debug("effective settings", "config", settings(v))

	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		logger.Error("load time zone", "err", err)
		os.Exit(1)
	}

	colour, err := board.ParseColour(cfg.Colour)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		fs.Usage()
		os.Exit(2)
	}
	rowPrefix, err := board.ParseRowPrefix(cfg.RowPrefix)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		fs.Usage()
		os.Exit(2)
	}
	if !slices.Contains([]string{"matrix", "window", "png"}, cfg.Display) {
		fmt.Fprintf(os.Stderr, "unknown display %q; want matrix, window, or png\n", cfg.Display)
		fs.Usage()
		os.Exit(2)
	}
	if *check {
		return
	}
	opts := &cfg.LED.Options
	b, err := formats.New(cfg.Board, formats.Config{
		Width: opts.Cols * opts.Chain, Height: opts.Rows * opts.Parallel,
		Zone: zone, Colour: colour, Worldline: cfg.Worldline, ScrollSpeed: cfg.ScrollSpeed, RowPrefix: rowPrefix,
		WarningPlatform: cfg.WarningPlatform,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		fs.Usage()
		os.Exit(2)
	}
	if setup {
		b = &setupdisplay.Board{Path: *setupStatus, Colour: colour}
	}
	if !v.IsSet("led.limit_refresh") {
		opts.LimitRefreshRateHz = b.RefreshHz()
	}
	if !v.IsSet("led.pwm_bits") {
		opts.PWMBits = matrix.PWMBitsFor(opts.LimitRefreshRateHz)
	}
	logger.Info("panel timing", "refresh_hz", opts.LimitRefreshRateHz, "pwm_bits", opts.PWMBits)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	a := app{
		board: b,
		setup: setup,
		live: live.Config{
			BaseURL:         cfg.URL,
			CRS:             cfg.CRS,
			Platforms:       cfg.Platforms,
			ShowUnconfirmed: cfg.ShowUnconfirmedPlatforms,
			LegacyTOCNames:  cfg.LegacyTOCNames,
			Logger:          logger,
		},
		fixture:    fixture,
		fps:        cfg.FPS,
		brightness: make(chan int, 1),
		logger:     logger,
	}
	if v.ConfigFileUsed() != "" {
		watch(v, logger, a.setBrightness)
	}

	// The window library must run on the main goroutine, so the window
	// display drives the app rather than the other way round.
	if cfg.Display == "window" {
		err := windowdisplay.Run(windowdisplay.Options{
			Width:  opts.Cols * opts.Chain,
			Height: opts.Rows * opts.Parallel,
			Scale:  cfg.Scale,
		}, func(d frame.Display) { a.run(ctx, d) })
		if err != nil {
			logger.Error("open window", "err", err)
			os.Exit(1)
		}
		return
	}

	display, err := openDisplay(cfg.Display, opts, cfg.PNGDir, cfg.Scale)
	if err != nil {
		logger.Error("open display", "err", err)
		os.Exit(1)
	}
	defer display.Close()
	a.run(ctx, display)
}

// openDisplay opens the display that the display setting names, other than the window.
func openDisplay(kind string, opts *matrix.Options, pngDir string, scale int) (frame.Display, error) {
	switch kind {
	case "matrix":
		return matrix.Open(opts)
	case "png":
		return pngdisplay.New(pngdisplay.Options{
			Dir:    pngDir,
			Scale:  scale,
			Width:  opts.Cols * opts.Chain,
			Height: opts.Rows * opts.Parallel,
		})
	default:
		return nil, fmt.Errorf("unknown display %q; want matrix, window, or png", kind)
	}
}

type app struct {
	board board.Board
	setup bool
	live  live.Config
	// fixture, when set, is shown in place of the live feed.
	fixture []model.View
	fps     int
	// brightness carries a changed led.brightness to the loop, which applies
	// it between frames. Only the latest value matters, so a newer one
	// replaces an unread one.
	brightness chan int
	logger     *slog.Logger
}

func (a app) setBrightness(percent int) {
	select {
	case <-a.brightness:
	default:
	}
	a.brightness <- percent
}

// run shows live departures on display until ctx is done or the display
// stops accepting frames, and then blanks it.
func (a app) run(ctx context.Context, display frame.Display) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	a.board.Update(model.View{})

	if a.fixture != nil {
		go playFixture(ctx, a.fixture, fixtureStep, fixtureRepeat, a.board.Update)
	} else if !a.setup {
		go live.Run(ctx, a.live, a.board.Update)
	}

	a.loop(ctx, display, a.board)

	w, h := display.Size()
	display.Swap(frame.New(w, h))
}

// loop redraws once per display refresh, or at the tick rate on a display
// without one, and only uploads a frame when the board changed, so an idle
// board costs almost nothing. Pacing on the refresh matters on the panel: a
// timer that beats against the refresh shows some frames for one refresh and
// others for two, which reads as jitter in scrolling text.
func (a app) loop(ctx context.Context, display frame.Display, b board.Board) {
	w, h := display.Size()
	f := frame.New(w, h)

	vsync, _ := display.(frame.VSyncer)
	var ticker *time.Ticker
	if vsync == nil {
		ticker = time.NewTicker(time.Second / time.Duration(a.fps))
		defer ticker.Stop()
	}

	for {
		if ticker != nil {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		} else if ctx.Err() != nil {
			return
		}

		changed := b.Tick(time.Now(), f)
		select {
		case percent := <-a.brightness:
			changed = a.dim(display, percent) || changed
		default:
		}

		var err error
		switch {
		case changed:
			err = display.Swap(f)
		case vsync != nil:
			err = vsync.WaitVSync()
		}
		if err != nil {
			if !errors.Is(err, windowdisplay.ErrClosed) {
				a.logger.Error("present frame", "err", err)
			}
			return
		}
	}
}

// dim applies a new brightness and reports whether the display needs
// redrawing to show it.
func (a app) dim(display frame.Display, percent int) bool {
	dimmer, ok := display.(frame.Dimmer)
	if !ok {
		a.logger.Warn("this display has no brightness control", "led.brightness", percent)
		return false
	}
	if err := dimmer.SetBrightness(percent); err != nil {
		a.logger.Error("set brightness", "err", err)
		return false
	}
	a.logger.Info("brightness changed", "percent", percent)
	return true
}
