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
//	  platformBox: false,               // Infotec only; requires exactly one requested platform
//	  colour: 'amber',                  // or 'white'
//	  scrollSpeed: 0,                   // dots per second; 0 for the board's default
//	  width: 256, height: 64,           // in dots
//	  verbose: false,                   // debug logging to the console
//	})
//	// On failure, create returns an Error instead.
//	board.tick(Date.now())  // advances the board; true when board.pixels changed
//	board.pixels            // Uint8Array of packed RGB, width × height × 3
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
	"strings"
	"syscall/js"
	"time"
	// Browsers have no zoneinfo files for time.LoadLocation to read.
	_ "time/tzdata"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/formats"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/live"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func main() {
	zone, err := time.LoadLocation("Europe/London")
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
	w, h := o.int("width", 256), o.int("height", 64)
	platforms := o.strings("platforms")
	for i := range platforms {
		platforms[i] = strings.ToUpper(platforms[i])
	}
	b, err := formats.New(o.string("board", "daktronics"), formats.Config{
		Width: w, Height: h, Zone: zone, Colour: colour, Worldline: o.bool("worldline"), ScrollSpeed: o.int("scrollSpeed", 0),
		RowPrefix: rowPrefix, WarningPlatform: o.bool("warningPlatform"),
		PlatformBox: o.bool("platformBox"), Platforms: platforms,
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
		Logger:          slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})),
	}
	if _, err := live.StreamURL(cfg); err != nil {
		return js.Value{}, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	b.Update(model.View{})
	go live.Run(ctx, cfg, b.Update)
	return newHandle(b, w, h, cancel), nil
}

func newHandle(b board.Board, w, h int, cancel context.CancelFunc) js.Value {
	f := frame.New(w, h)
	pixels := js.Global().Get("Uint8Array").New(len(f.Pix))
	obj := js.Global().Get("Object").New()
	obj.Set("width", w)
	obj.Set("height", h)
	obj.Set("refreshHz", b.RefreshHz())
	obj.Set("pixels", pixels)

	var tick, closeFn js.Func
	tick = js.FuncOf(func(_ js.Value, args []js.Value) any {
		now := time.Now()
		if len(args) > 0 && args[0].Type() == js.TypeNumber {
			now = time.UnixMilli(int64(args[0].Float()))
		}
		if !b.Tick(now, f) {
			return false
		}
		js.CopyBytesToJS(pixels, f.Pix)
		return true
	})
	closeFn = js.FuncOf(func(js.Value, []js.Value) any {
		cancel()
		tick.Release()
		closeFn.Release()
		return nil
	})
	obj.Set("tick", tick)
	obj.Set("close", closeFn)
	return obj
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
