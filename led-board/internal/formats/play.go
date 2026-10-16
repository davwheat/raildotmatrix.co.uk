package formats

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Settled is how long each format takes to finish its entrance, and any second view's transition, so that a frame
// taken then shows the screen a fixture is about rather than a frame of an animation.
var Settled = map[string]time.Duration{
	"daktronics": 8600 * time.Millisecond,
	"infotec":    4600 * time.Millisecond,
}

const (
	// FixtureStep is the time between a fixture's views.
	FixtureStep = 2 * time.Second
	// FixtureRepeat is how long the board app shows a fixture's last view before it starts the fixture again.
	FixtureRepeat = 20 * time.Second
	playTick      = 20 * time.Millisecond
)

// Play shows a fixture's views on b as the board app would, at 50 Hz from fixtures.Clock, and returns the w × h
// frame at the given time after the start.
func Play(b board.Board, steps []model.View, w, h int, at time.Duration) *frame.Frame {
	var last *frame.Frame
	PlayEach(b, steps, w, h, []time.Duration{at}, func(_ int, f *frame.Frame) { last = f })
	return last
}

// PlayEach plays a fixture as Play does, and hands each the frame at each of the times, which must not decrease, in
// one playback. The frame is reused, so each must copy what it keeps.
func PlayEach(b board.Board, steps []model.View, w, h int, times []time.Duration, each func(i int, f *frame.Frame)) {
	if len(times) == 0 {
		return
	}
	f := frame.New(w, h)
	b.Update(steps[0])
	next := 0
	for now := fixtures.Clock; next < len(times); now = now.Add(playTick) {
		if len(steps) > 1 && now.Equal(fixtures.Clock.Add(FixtureStep)) {
			b.Update(steps[1])
		}
		b.Tick(now, f)
		for next < len(times) && now.Add(playTick).After(fixtures.Clock.Add(times[next])) {
			each(next, f)
			next++
		}
	}
}
