//go:build js && wasm

package main

import (
	"syscall/js"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
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
	h, _ := newHandle(&pixelHandleBoard{}, 1, 1, func() {})
	defer h.Call("close")
	h.Call("tick", 1003)
	if h.Get("nextTick").Int() != 1020 {
		t.Fatal("WASM handle did not select the pixel deadline over native pacing")
	}
}

func TestHandleDeadlineAndFeedWakeup(t *testing.T) {
	b := &handleBoard{changed: true}
	closed := false
	h, update := newHandle(b, 1, 1, func() { closed = true })
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
	h, update := newHandle(&handleBoard{}, 1, 1, func() {})
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
