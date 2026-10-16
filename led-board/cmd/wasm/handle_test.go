//go:build js && wasm

package main

import (
	"syscall/js"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/formats"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/london"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

type handleBoard struct{ changed, animate bool }

func (b *handleBoard) Update(v model.View) { b.changed, b.animate = true, v.Connected }
func (b *handleBoard) Tick(_ time.Time, f *frame.Frame) bool {
	if !b.changed {
		return false
	}
	f.Set(0, 0, frame.RGB{R: 230, G: 150})
	b.changed = false
	return true
}
func (b *handleBoard) NextTick(now time.Time) time.Time {
	if b.animate {
		return time.Time{}
	}
	return now.Truncate(time.Second).Add(time.Second)
}
func (*handleBoard) RefreshHz() int { return 60 }

type pixelHandleBoard struct{ handleBoard }

func (*pixelHandleBoard) NextPixelTick(now time.Time) time.Time {
	return now.Add(17 * time.Millisecond)
}

func TestHandlePrefersPixelDeadline(t *testing.T) {
	h, _ := newHandle(&pixelHandleBoard{}, 1, 1, func() {}, nil)
	defer h.Call("close")
	h.Call("tick", 1003)
	if h.Get("nextTick").Int() != 1020 {
		t.Fatal("WASM handle did not select the pixel deadline over native pacing")
	}
}

func TestHandleDeadlineAndFeedWakeup(t *testing.T) {
	b := &handleBoard{changed: true}
	closed := false
	h, update := newHandle(b, 1, 1, func() { closed = true }, nil)
	if !h.Call("tick", 1003).Bool() || h.Get("nextTick").Int() != 2000 {
		t.Fatal("initial tick did not expose its deadline")
	}
	pixels := make([]byte, 3)
	js.CopyBytesToGo(pixels, h.Get("pixels"))
	if pixels[0] != 230 || pixels[1] != 150 || pixels[2] != 0 {
		t.Fatalf("pixels %v", pixels)
	}
	if h.Call("tick", 1500).Bool() {
		t.Fatal("unchanged frame was copied again")
	}
	update(model.View{Connected: true})
	if h.Get("nextTick").Int() != 0 {
		t.Fatal("feed update did not invalidate deadline")
	}
	if !h.Call("tick", 1501).Bool() || h.Get("nextTick").Int() != 0 {
		t.Fatal("animation was postponed")
	}
	update(model.View{})
	h.Call("tick", 1502)
	if h.Get("nextTick").Int() != 2000 {
		t.Fatal("static view did not restore deadline")
	}
	h.Call("close")
	if !closed {
		t.Fatal("close did not cancel live feed")
	}
}

func TestHandleNotifiesOutsideLockAndClearsCallbackOnClose(t *testing.T) {
	h, update := newHandle(&handleBoard{}, 1, 1, func() {}, nil)
	if !h.Get("onUpdate").IsNull() {
		t.Fatal("new handle must advertise its notification capability")
	}
	h.Set("notifications", 0)
	notify := js.Global().Get("Function").New("handle", `return function () {
		handle.notifications++;
		handle.tick(1500);
	}`)
	h.Set("onUpdate", notify.Invoke(h))
	update(model.View{})
	if h.Get("notifications").Int() != 1 || h.Get("nextTick").Int() != 2000 {
		t.Fatal("notification did not allow a synchronous tick")
	}
	h.Call("close")
	update(model.View{})
	if !h.Get("onUpdate").IsNull() || h.Get("notifications").Int() != 1 {
		t.Fatal("closed handle notified its former renderer")
	}
}

type recordingBoard struct {
	handleBoard
	views []model.View
}

func (b *recordingBoard) Update(v model.View) {
	b.handleBoard.Update(v)
	b.views = append(b.views, v)
}

func TestHandlePlaysFixtureInTimeWithTicks(t *testing.T) {
	first, second := model.View{Connected: true}, model.View{}
	b := &recordingBoard{}
	h, _ := newHandle(b, 1, 1, func() {}, []model.View{first, second})
	defer h.Call("close")
	h.Call("tick", 10_000)
	if len(b.views) != 1 || !b.views[0].Connected {
		t.Fatalf("first tick showed %v, want the fixture's first view", b.views)
	}
	h.Call("tick", 11_999)
	if len(b.views) != 1 {
		t.Fatal("second view came before formats.FixtureStep")
	}
	h.Call("tick", 12_000)
	if len(b.views) != 2 || b.views[1].Connected {
		t.Fatalf("views %v, want the second view two seconds in", b.views)
	}
	h.Call("tick", 31_999)
	if len(b.views) != 2 {
		t.Fatal("fixture repeated early")
	}
	h.Call("tick", 32_000)
	if len(b.views) != 3 || !b.views[2].Connected {
		t.Fatalf("views %v, want the fixture to start again", b.views)
	}
}

func TestHandleWakesForFixtureStep(t *testing.T) {
	h, _ := newHandle(&handleBoard{}, 1, 1, func() {}, []model.View{{}, {}})
	defer h.Call("close")
	h.Call("tick", 1_500)
	if got := h.Get("nextTick").Int(); got != 2_000 {
		t.Fatalf("nextTick %d, want the board's deadline before the fixture step", got)
	}
	h.Call("tick", 2_000)
	if got := h.Get("nextTick").Int(); got != 3_000 {
		t.Fatalf("nextTick %d, want the board's next second", got)
	}
	h.Call("tick", 3_400)
	if got := h.Get("nextTick").Int(); got != 3_500 {
		t.Fatalf("nextTick %d, want the fixture step at 3500", got)
	}
}

func TestRenderMatchesPlay(t *testing.T) {
	zone, err := london.Load()
	if err != nil {
		t.Fatal(err)
	}
	options := js.Global().Get("Object").New()
	options.Set("board", "infotec")
	options.Set("fixture", "busy-board")
	options.Set("clockStyle", "small")
	options.Set("platformBox", true)
	still, err := render(zone, []js.Value{options})
	if err != nil {
		t.Fatal(err)
	}
	b, err := formats.New("infotec", formats.Config{Width: 256, Height: 64, Zone: zone, ClockStyle: "small", PlatformBox: true, ServiceCount: 3})
	if err != nil {
		t.Fatal(err)
	}
	want := formats.Play(b, fixtures.Steps("busy-board"), 256, 64, formats.Settled["infotec"])
	got := make([]byte, still.Get("pixels").Length())
	js.CopyBytesToGo(got, still.Get("pixels"))
	if still.Get("width").Int() != 256 || still.Get("height").Int() != 64 || string(got) != string(want.Pix) {
		t.Fatal("render drew a different frame from formats.Play")
	}
	options.Set("fixture", js.Undefined())
	if _, err := render(zone, []js.Value{options}); err == nil {
		t.Fatal("render without a fixture succeeded")
	}
}

func TestRenderListOfTimes(t *testing.T) {
	zone, err := london.Load()
	if err != nil {
		t.Fatal(err)
	}
	options := js.Global().Get("Object").New()
	options.Set("board", "infotec")
	options.Set("fixture", "busy-board")
	options.Set("at", js.ValueOf([]any{4600, 11000}))
	stills, err := render(zone, []js.Value{options})
	if err != nil {
		t.Fatal(err)
	}
	if stills.Length() != 2 {
		t.Fatalf("got %d stills, want 2", stills.Length())
	}
	for i, at := range []time.Duration{4600 * time.Millisecond, 11 * time.Second} {
		b, err := formats.New("infotec", formats.Config{Width: 256, Height: 64, Zone: zone, ServiceCount: 3})
		if err != nil {
			t.Fatal(err)
		}
		want := formats.Play(b, fixtures.Steps("busy-board"), 256, 64, at)
		got := make([]byte, len(want.Pix))
		js.CopyBytesToGo(got, stills.Index(i).Get("pixels"))
		if string(got) != string(want.Pix) {
			t.Errorf("still %d differs from formats.Play at %v", i, at)
		}
	}
	options.Set("at", js.ValueOf([]any{11000, 4600}))
	if _, err := render(zone, []js.Value{options}); err == nil {
		t.Fatal("render took times that decrease")
	}
}
