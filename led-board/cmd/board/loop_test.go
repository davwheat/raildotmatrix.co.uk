package main

import (
	"context"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/testpattern"
)

type sleepingBoard struct {
	changed atomic.Bool
	ticks   chan struct{}
}

func (b *sleepingBoard) Update(model.View) { b.changed.Store(true) }
func (b *sleepingBoard) Tick(time.Time, *frame.Frame) bool {
	b.ticks <- struct{}{}
	return b.changed.Swap(false)
}
func (b *sleepingBoard) RefreshHz() int                   { return 60 }
func (b *sleepingBoard) NextTick(now time.Time) time.Time { return now.Add(time.Hour) }

type sleepingDisplay struct {
	swaps      chan struct{}
	brightness chan int
}

func (d *sleepingDisplay) Size() (int, int)              { return 1, 1 }
func (d *sleepingDisplay) Swap(*frame.Frame) error       { d.swaps <- struct{}{}; return nil }
func (d *sleepingDisplay) WaitVSync() error              { return nil }
func (d *sleepingDisplay) Close() error                  { return nil }
func (d *sleepingDisplay) SetBrightness(value int) error { d.brightness <- value; return nil }

func TestIdleWaitWakesForUpdatesBrightnessAndCancellation(t *testing.T) {
	b := &sleepingBoard{ticks: make(chan struct{}, 8)}
	d := &sleepingDisplay{swaps: make(chan struct{}, 8), brightness: make(chan int, 8)}
	a := app{board: b, wake: make(chan struct{}, 1), brightness: make(chan int, 1), logger: slog.New(slog.DiscardHandler)}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { a.loop(ctx, d, b); close(done) }()
	wait := func(ch <-chan struct{}, reason string) {
		t.Helper()
		select {
		case <-ch:
		case <-time.After(time.Second):
			t.Fatal(reason)
		}
	}
	wait(b.ticks, "initial tick missing")
	a.update(model.View{Connected: true})
	wait(b.ticks, "feed update did not interrupt sleep")
	wait(d.swaps, "updated view not swapped")
	a.setBrightness(50)
	select {
	case value := <-d.brightness:
		if value != 50 {
			t.Fatalf("brightness %d", value)
		}
	case <-time.After(time.Second):
		t.Fatal("brightness did not interrupt sleep")
	}
	wait(d.swaps, "brightness did not force an unchanged frame to upload")
	cancel()
	wait(done, "cancellation did not interrupt sleep")
}

type recordingDisplay struct{ swaps chan frame.RGB }

func (d *recordingDisplay) Size() (int, int)          { return 4, 2 }
func (d *recordingDisplay) Swap(f *frame.Frame) error { d.swaps <- f.At(0, 0); return nil }
func (d *recordingDisplay) WaitVSync() error          { return nil }
func (d *recordingDisplay) Close() error              { return nil }

type paintingBoard struct{ sleepingBoard }

func (b *paintingBoard) Tick(now time.Time, f *frame.Frame) bool {
	if !b.changed.Swap(false) {
		return false
	}
	f.Set(0, 0, frame.RGB{R: 1, G: 2, B: 3})
	return true
}

func TestTestPatternReplacesBoardUntilItEnds(t *testing.T) {
	b := &paintingBoard{}
	b.changed.Store(true)
	d := &recordingDisplay{swaps: make(chan frame.RGB, 8)}
	a := app{board: b, wake: make(chan struct{}, 1), brightness: make(chan int, 1), tests: make(chan testpattern.Request, 1), panelW: 4, panelH: 2, logger: slog.New(slog.DiscardHandler)}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go a.loop(ctx, d, b)
	swap := func(want frame.RGB, reason string) {
		t.Helper()
		select {
		case got := <-d.swaps:
			if got != want {
				t.Fatalf("%s: first dot %+v, want %+v", reason, got, want)
			}
		case <-time.After(time.Second):
			t.Fatal(reason + ": no swap")
		}
	}
	boardDot := frame.RGB{R: 1, G: 2, B: 3}
	swap(boardDot, "board")
	a.setTest(testpattern.Request{Pattern: "green", Until: time.Now().Add(time.Hour)})
	swap(frame.RGB{G: 255}, "pattern")
	a.setTest(testpattern.Request{Pattern: "red", Until: time.Now().Add(150 * time.Millisecond)})
	swap(frame.RGB{R: 255}, "replacement pattern")
	// The board doesn't change, so only the end of the pattern can bring back its picture.
	swap(boardDot, "board after the pattern expired")
}
