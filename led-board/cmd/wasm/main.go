//go:build js && wasm

// Command wasm runs the departure boards in a web page. It sets a global ledDepartureBoard object whose create
// method starts a board fed by the live stream, and the page draws the board's frames. The API:
//
//	const board = ledDepartureBoard.create({
//	  board: 'infotec',                 // or 'daktronics' (the default)
//	  crs: 'GTW',                       // required
//	  url: 'wss://darwinbrowser.com',   // the default; /v1/cis/live is appended
//	  platforms: ['1', '2'],            // optional; the whole station by default
//	  showUnconfirmedPlatforms: false,
//	  hideTerminating: false,
//	  legacyTocNames: false,
//	  worldline: false,                 // Daktronics only
//	  pageDestinations: false,          // Daktronics only; page dividing trains' destinations on the lower row
//	  reserveEtdColumn: false,          // Daktronics only; keep every destination clear of the space "Cancelled" needs
//	  clearDownWarningToCis: false,     // Daktronics only; wipe a warning away when no trains follow it
//	  rowPrefix: 'ordinals',            // or 'platforms' ("Pl 1")
//	  warningPlatform: false,           // name the platform in warnings, in place of "this station"
//	  alignPlatformRows: true,          // align lower rows beneath the Infotec platform box
//	  serviceSeparator: true,           // Infotec only; the line between the first train and the later trains
//	  ordinalFormat: "suffix",          // suffix (1st) or dot (1.)
//	  serviceCount: 3,                   // 1 to 6 services; later services rotate on the lower row
//	  formationCount: 'none',           // Infotec only; none, number, coaches, coaches-no-brackets, carriages or carriages-no-brackets
//	  coachLetterTocs: ['VT', 'GR', 'GW', 'LD', 'LF', 'GC', 'HT', 'SR', 'AW', 'EM'], // Infotec only; [] hides all letters
//	  formationIcons: ['accessibility', 'cycles', 'toilets', 'food', 'first-class'], // Infotec only; [] hides all facility icons
//	  compactLowerRow: true,           // smaller lower service row beside the clock
//	  platformBox: false,               // Infotec only; shows the first service platform when watching multiple platforms
//	  colour: 'amber',                  // or 'white'
//	  scrollSpeed: 0,                   // dots per second; 0 for the board's default
//	  smallScrollingText: false,        // Infotec only; compact calling points and service information
//	  ampersandCallingPoints: false,    // Infotec only; join the last two calling points with "&"
//	  width: 256, height: 64,           // in dots
//	  verbose: false,                   // debug logging to the console
//	})
//	// On failure, create returns an Error instead.
//	// With fixture set to one of ledDepartureBoard.fixtures, such as 'busy-board', the board plays that built-in
//	// example in place of the live feed, and crs isn't needed. Its views change with the times given to tick.
//	board.tick(Date.now())  // advances the board; true when board.pixels changed
//	board.pixels            // Uint8Array of packed RGB, width × height × 3
//	board.nextTick          // earliest time-driven change; 0 for refresh pacing or after a feed update
//	board.onUpdate = () => requestAnimationFrame(draw) // optional notification when live data changes
//	board.close()           // stops the live stream
//
//	// render draws a fixture as it looks a given time after it starts, without a live stream or a handle. It
//	// takes create's options, with fixture required and at in milliseconds; at defaults to the time the board
//	// takes to settle after its entrance. With a list of times that don't decrease, such as at: [10000, 10500],
//	// render plays the fixture once and returns a list of stills.
//	const still = ledDepartureBoard.render({ board: 'infotec', fixture: 'busy-board', clockStyle: 'small', at: 4600 })
//	still.width, still.height, still.pixels // as on a board; render returns an Error on failure
//
// If the page defines globalThis.ledDepartureBoardReady before starting the module, it's called with the
// ledDepartureBoard object once create is available.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime/debug"
	"strings"
	"sync"
	"syscall/js"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/formats"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/live"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/london"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func main() {
	// Desktop-browser burst measurements favour fewer collections, at a small
	// increase in linear memory. Keep an explicit runtime environment override.
	if os.Getenv("GOGC") == "" {
		debug.SetGCPercent(200)
	}
	zone, err := london.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "led departure board: loading the time zone:", err)
		return
	}

	api := js.Global().Get("Object").New()
	api.Set("create", js.FuncOf(func(_ js.Value, args []js.Value) any {
		h, err := create(zone, args)
		if err != nil {
			return js.Global().Get("Error").New(err.Error())
		}
		return h
	}))
	api.Set("render", js.FuncOf(func(_ js.Value, args []js.Value) any {
		still, err := render(zone, args)
		if err != nil {
			return js.Global().Get("Error").New(err.Error())
		}
		return still
	}))
	api.Set("boards", stringArray(formats.Names))
	api.Set("fixtures", stringArray(fixtures.Names))
	js.Global().Set("ledDepartureBoard", api)
	if ready := js.Global().Get("ledDepartureBoardReady"); ready.Type() == js.TypeFunction {
		ready.Invoke(api)
	}

	// The callbacks run on this program's goroutines, so it must outlive every board the page creates.
	select {}
}

func create(zone *time.Location, args []js.Value) (js.Value, error) {
	o, err := optionsArg("create", args)
	if err != nil {
		return js.Value{}, err
	}
	crs := strings.ToUpper(o.string("crs", ""))
	steps, err := fixtureSteps(o)
	if err != nil {
		return js.Value{}, err
	}
	if crs == "" && steps == nil {
		return js.Value{}, errors.New("ledDepartureBoard.create: crs is required")
	}
	name, c, err := boardConfig(zone, o)
	if err != nil {
		return js.Value{}, err
	}
	b, err := formats.New(name, c)
	if err != nil {
		return js.Value{}, err
	}
	b.Update(model.View{})
	if steps != nil {
		handle, _ := newHandle(b, c.Width, c.Height, func() {}, steps)
		return handle, nil
	}

	level := slog.LevelWarn
	if o.bool("verbose") {
		level = slog.LevelDebug
	}
	cfg := live.Config{
		BaseURL:         o.string("url", "wss://darwinbrowser.com"),
		CRS:             crs,
		Platforms:       c.Platforms,
		ShowUnconfirmed: o.bool("showUnconfirmedPlatforms"),
		HideTerminating: o.bool("hideTerminating"),
		LegacyTOCNames:  o.bool("legacyTocNames"),
		MaxServices:     board.ServiceLimit(b),
		Logger:          slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})),
	}
	if _, err := live.StreamURL(cfg); err != nil {
		return js.Value{}, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	handle, update := newHandle(b, c.Width, c.Height, cancel, nil)
	go live.Run(ctx, cfg, update)
	return handle, nil
}

func render(zone *time.Location, args []js.Value) (js.Value, error) {
	o, err := optionsArg("render", args)
	if err != nil {
		return js.Value{}, err
	}
	steps, err := fixtureSteps(o)
	if err != nil {
		return js.Value{}, err
	}
	if steps == nil {
		return js.Value{}, errors.New("ledDepartureBoard.render: fixture is required")
	}
	name, c, err := boardConfig(zone, o)
	if err != nil {
		return js.Value{}, err
	}
	b, err := formats.New(name, c)
	if err != nil {
		return js.Value{}, err
	}
	times := []time.Duration{formats.Settled[name]}
	at := o.v.Get("at")
	if at.Type() == js.TypeNumber {
		times[0] = milliseconds(at)
	} else if js.Global().Get("Array").Call("isArray", at).Bool() {
		times = make([]time.Duration, at.Length())
		for i := range times {
			times[i] = milliseconds(at.Index(i))
		}
	}
	for i, t := range times {
		if t < 0 || t > time.Minute || (i > 0 && t < times[i-1]) {
			return js.Value{}, errors.New("ledDepartureBoard.render: at must be from 0 to 60000 milliseconds, and a list of times mustn't decrease")
		}
	}
	stills := js.Global().Get("Array").New()
	formats.PlayEach(b, steps, c.Width, c.Height, times, func(_ int, f *frame.Frame) {
		pixels := js.Global().Get("Uint8Array").New(len(f.Pix))
		js.CopyBytesToJS(pixels, f.Pix)
		still := js.Global().Get("Object").New()
		still.Set("width", c.Width)
		still.Set("height", c.Height)
		still.Set("pixels", pixels)
		stills.Call("push", still)
	})
	if at.Type() == js.TypeObject {
		return stills, nil
	}
	return stills.Index(0), nil
}

// milliseconds reads a time in milliseconds, where anything but a number is out of range.
func milliseconds(v js.Value) time.Duration {
	if v.Type() != js.TypeNumber {
		return -1
	}
	return time.Duration(v.Float() * float64(time.Millisecond))
}

func optionsArg(method string, args []js.Value) (options, error) {
	if len(args) != 1 || args[0].Type() != js.TypeObject {
		return options{}, fmt.Errorf("ledDepartureBoard.%s takes one options object", method)
	}
	return options{args[0]}, nil
}

// fixtureSteps returns the views of the fixture that the options name, or nil when they name none.
func fixtureSteps(o options) ([]model.View, error) {
	name := o.string("fixture", "")
	if name == "" {
		return nil, nil
	}
	steps := fixtures.Steps(name)
	if steps == nil {
		return nil, fmt.Errorf("unknown fixture %q", name)
	}
	return steps, nil
}

// boardConfig reads the board format and its settings from create's options.
func boardConfig(zone *time.Location, o options) (string, formats.Config, error) {
	colour, err := board.ParseColour(o.string("colour", "amber"))
	if err != nil {
		return "", formats.Config{}, err
	}
	rowPrefix, err := board.ParseRowPrefix(o.string("rowPrefix", "ordinals"))
	if err != nil {
		return "", formats.Config{}, err
	}
	ordinalFormat, err := board.ParseOrdinalFormat(o.string("ordinalFormat", "suffix"))
	if err != nil {
		return "", formats.Config{}, err
	}
	serviceCount := o.int("serviceCount", 3)
	if serviceCount < 1 || serviceCount > 6 {
		return "", formats.Config{}, errors.New("service count must be between 1 and 6")
	}
	platforms := o.strings("platforms")
	for i := range platforms {
		platforms[i] = strings.ToUpper(platforms[i])
	}
	compactLowerRow := true
	if value, ok := o.get("compactLowerRow", js.TypeBoolean); ok {
		compactLowerRow = value.Bool()
	}
	alignPlatformRows := true
	if value, ok := o.get("alignPlatformRows", js.TypeBoolean); ok {
		alignPlatformRows = value.Bool()
	}
	serviceSeparator := true
	if value, ok := o.get("serviceSeparator", js.TypeBoolean); ok {
		serviceSeparator = value.Bool()
	}
	return o.string("board", "daktronics"), formats.Config{
		Width: o.int("width", 256), Height: o.int("height", 64), Zone: zone, Colour: colour, Worldline: o.bool("worldline"), PageDestinations: o.bool("pageDestinations"), ReserveETDColumn: o.bool("reserveEtdColumn"), ClearDownWarningToCIS: o.bool("clearDownWarningToCis"), ScrollSpeed: o.int("scrollSpeed", 0),
		RowPrefix: rowPrefix, OrdinalFormat: ordinalFormat, LoadingBrightness: o.int("loadingBrightness", 50), ClockStyle: o.string("clockStyle", ""), ServiceCount: serviceCount, WarningPlatform: o.bool("warningPlatform"),
		FormationCount:         o.string("formationCount", "none"),
		CoachLetterTOCs:        o.strings("coachLetterTocs"),
		FormationIcons:         o.strings("formationIcons"),
		SmallScrollingText:     o.bool("smallScrollingText"),
		AmpersandCallingPoints: o.bool("ampersandCallingPoints"),
		CompactLowerRow:        &compactLowerRow, PlatformBox: o.bool("platformBox"), Platforms: platforms, AlignPlatformRows: &alignPlatformRows,
		ServiceSeparator: &serviceSeparator,
	}, nil
}

// newHandle returns the page's handle on b, and the function that shows b a new view. With steps, the handle plays
// them as a fixture, in time with its ticks.
func newHandle(b board.Board, w, h int, cancel context.CancelFunc, steps []model.View) (js.Value, func(model.View)) {
	f := frame.New(w, h)
	var player *fixturePlayer
	if steps != nil {
		player = &fixturePlayer{steps: steps}
	}
	pixels := js.Global().Get("Uint8Array").New(len(f.Pix))
	obj := js.Global().Get("Object").New()
	obj.Set("width", w)
	obj.Set("height", h)
	obj.Set("refreshHz", b.RefreshHz())
	obj.Set("pixels", pixels)
	obj.Set("nextTick", 0)
	obj.Set("onUpdate", js.Null())
	var nextDeadline func(time.Time) time.Time
	if pixels, ok := b.(board.PixelTicker); ok {
		nextDeadline = pixels.NextPixelTick
	} else if deadlines, ok := b.(board.NextTicker); ok {
		nextDeadline = deadlines.NextTick
	}
	var mu sync.Mutex
	var nextTick int64
	setDeadline := func(value int64) {
		if value != nextTick {
			nextTick = value
			obj.Set("nextTick", float64(value))
		}
	}

	var tick, closeFn js.Func
	tick = js.FuncOf(func(_ js.Value, args []js.Value) any {
		mu.Lock()
		defer mu.Unlock()
		now := time.Now()
		if len(args) > 0 && args[0].Type() == js.TypeNumber {
			now = time.UnixMilli(int64(args[0].Float()))
		}
		if player != nil {
			if v, ok := player.view(now); ok {
				b.Update(v)
			}
		}
		changed := b.Tick(now, f)
		if nextDeadline != nil {
			deadline := nextDeadline(now)
			if player != nil && !deadline.IsZero() {
				if step := player.next(); !step.IsZero() && step.Before(deadline) {
					deadline = step
				}
			}
			if deadline.IsZero() {
				setDeadline(0)
			} else {
				setDeadline(deadline.UnixMilli())
			}
		}
		if !changed {
			return false
		}
		js.CopyBytesToJS(pixels, f.Pix)
		return true
	})
	closeFn = js.FuncOf(func(js.Value, []js.Value) any {
		obj.Set("onUpdate", js.Null())
		cancel()
		tick.Release()
		closeFn.Release()
		return nil
	})
	obj.Set("tick", tick)
	obj.Set("close", closeFn)
	return obj, func(v model.View) {
		// Publish the new data and clear its deadline together, so a tick
		// cannot accidentally postpone a concurrently arriving update.
		mu.Lock()
		b.Update(v)
		setDeadline(0)
		mu.Unlock()
		// Notification handlers may call tick synchronously, so release the
		// board lock first. Closing the handle clears this callback.
		if notify := obj.Get("onUpdate"); notify.Type() == js.TypeFunction {
			notify.Invoke()
		}
	}
}

// fixturePlayer plays a fixture as the board app does: its second view follows the first after
// formats.FixtureStep, and the fixture starts again formats.FixtureRepeat later, so that the change it shows
// keeps recurring. A fixture with a single view is shown once.
type fixturePlayer struct {
	steps []model.View
	start time.Time
	shown int
}

// view returns the view to show at now, if it isn't the one already shown.
func (p *fixturePlayer) view(now time.Time) (model.View, bool) {
	if p.start.IsZero() || (len(p.steps) > 1 && !now.Before(p.start.Add(p.length()))) {
		p.start, p.shown = now, 0
		return p.steps[0], true
	}
	if next := p.next(); p.shown < len(p.steps)-1 && !now.Before(next) {
		p.shown++
		return p.steps[p.shown], true
	}
	return model.View{}, false
}

// next returns when the next view is due, or zero for a fixture with a single view.
func (p *fixturePlayer) next() time.Time {
	if len(p.steps) < 2 {
		return time.Time{}
	}
	if p.shown < len(p.steps)-1 {
		return p.start.Add(time.Duration(p.shown+1) * formats.FixtureStep)
	}
	return p.start.Add(p.length())
}

func (p *fixturePlayer) length() time.Duration {
	return time.Duration(len(p.steps)-1)*formats.FixtureStep + formats.FixtureRepeat
}

func stringArray(values []string) js.Value {
	array := js.Global().Get("Array").New()
	for _, value := range values {
		array.Call("push", value)
	}
	return array
}

// options reads create's options object, where a missing or mistyped key means its default.
type options struct{ v js.Value }

func (o options) get(key string, t js.Type) (js.Value, bool) {
	v := o.v.Get(key)
	return v, v.Type() == t
}

func (o options) string(key, fallback string) string {
	if v, ok := o.get(key, js.TypeString); ok {
		return v.String()
	}
	return fallback
}

func (o options) int(key string, fallback int) int {
	if v, ok := o.get(key, js.TypeNumber); ok {
		return v.Int()
	}
	return fallback
}

func (o options) bool(key string) bool {
	v, ok := o.get(key, js.TypeBoolean)
	return ok && v.Bool()
}

func (o options) strings(key string) []string {
	v := o.v.Get(key)
	if !js.Global().Get("Array").Call("isArray", v).Bool() {
		return nil
	}
	out := make([]string, 0, v.Length())
	for i := range v.Length() {
		if s := v.Index(i); s.Type() == js.TypeString {
			out = append(out, s.String())
		}
	}
	return out
}
