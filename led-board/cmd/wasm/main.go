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
//	  legacyTocNames: false,
//	  worldline: false,                 // Daktronics only
//	  rowPrefix: 'ordinals',            // or 'platforms' ("Pl 1")
//	  warningPlatform: false,           // name the platform in warnings, in place of "this station"
//	  alignPlatformRows: true,          // align lower rows beneath the Infotec platform box
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
//	  width: 256, height: 64,           // in dots
//	  verbose: false,                   // debug logging to the console
//	})
//	// On failure, create returns an Error instead.
//	board.tick(Date.now())  // advances the board; true when board.pixels changed
//	board.pixels            // Uint8Array of packed RGB, width × height × 3
//	board.nextTick          // earliest time-driven change; 0 for refresh pacing or after a feed update
//	board.onUpdate = () => requestAnimationFrame(draw) // optional notification when live data changes
//	board.close()           // stops the live stream
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
	names := js.Global().Get("Array").New()
	for _, name := range formats.Names {
		names.Call("push", name)
	}
	api.Set("boards", names)
	js.Global().Set("ledDepartureBoard", api)
	if ready := js.Global().Get("ledDepartureBoardReady"); ready.Type() == js.TypeFunction {
		ready.Invoke(api)
	}

	// The callbacks run on this program's goroutines, so it must outlive every board the page creates.
	select {}
}

func create(zone *time.Location, args []js.Value) (js.Value, error) {
	if len(args) != 1 || args[0].Type() != js.TypeObject {
		return js.Value{}, errors.New("ledDepartureBoard.create takes one options object")
	}
	o := options{args[0]}

	crs := strings.ToUpper(o.string("crs", ""))
	if crs == "" {
		return js.Value{}, errors.New("ledDepartureBoard.create: crs is required")
	}
	colour, err := board.ParseColour(o.string("colour", "amber"))
	if err != nil {
		return js.Value{}, err
	}
	rowPrefix, err := board.ParseRowPrefix(o.string("rowPrefix", "ordinals"))
	if err != nil {
		return js.Value{}, err
	}
	ordinalFormat, err := board.ParseOrdinalFormat(o.string("ordinalFormat", "suffix"))
	if err != nil {
		return js.Value{}, err
	}
	serviceCount := o.int("serviceCount", 3)
	if serviceCount < 1 || serviceCount > 6 {
		return js.Value{}, errors.New("service count must be between 1 and 6")
	}
	w, h := o.int("width", 256), o.int("height", 64)
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
	b, err := formats.New(o.string("board", "daktronics"), formats.Config{
		Width: w, Height: h, Zone: zone, Colour: colour, Worldline: o.bool("worldline"), ScrollSpeed: o.int("scrollSpeed", 0),
		RowPrefix: rowPrefix, OrdinalFormat: ordinalFormat, LoadingBrightness: o.int("loadingBrightness", 50), ClockStyle: o.string("clockStyle", ""), ServiceCount: serviceCount, WarningPlatform: o.bool("warningPlatform"),
		FormationCount:     o.string("formationCount", "none"),
		CoachLetterTOCs:    o.strings("coachLetterTocs"),
		FormationIcons:     o.strings("formationIcons"),
		SmallScrollingText: o.bool("smallScrollingText"),
		CompactLowerRow:    &compactLowerRow, PlatformBox: o.bool("platformBox"), Platforms: platforms, AlignPlatformRows: &alignPlatformRows,
	})
	if err != nil {
		return js.Value{}, err
	}

	level := slog.LevelWarn
	if o.bool("verbose") {
		level = slog.LevelDebug
	}
	cfg := live.Config{
		BaseURL:         o.string("url", "wss://darwinbrowser.com"),
		CRS:             crs,
		Platforms:       platforms,
		ShowUnconfirmed: o.bool("showUnconfirmedPlatforms"),
		LegacyTOCNames:  o.bool("legacyTocNames"),
		MaxServices:     board.ServiceLimit(b),
		Logger:          slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})),
	}
	if _, err := live.StreamURL(cfg); err != nil {
		return js.Value{}, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	b.Update(model.View{})
	handle, update := newHandle(b, w, h, cancel)
	go live.Run(ctx, cfg, update)
	return handle, nil
}

func newHandle(b board.Board, w, h int, cancel context.CancelFunc) (js.Value, func(model.View)) {
	f := frame.New(w, h)
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
		changed := b.Tick(now, f)
		if nextDeadline != nil {
			deadline := nextDeadline(now)
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
