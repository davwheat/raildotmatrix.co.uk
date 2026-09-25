package main

import (
	"context"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
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
