package main

import (
	"context"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// The tests and cmd/preview send a fixture's second view two seconds after its first, so the board does too. It then
// starts the fixture again, so that the change the fixture shows, such as a departure, keeps recurring.
const (
	fixtureStep   = 2 * time.Second
	fixtureRepeat = 20 * time.Second
)

// playFixture shows a fixture's views in place of the live feed until ctx is done. A fixture with a single view is
// shown once, since repeating it would change nothing.
func playFixture(ctx context.Context, steps []model.View, step, repeat time.Duration, update func(model.View)) {
	for {
		for i, v := range steps {
			if i > 0 && !wait(ctx, step) {
				return
			}
			update(v)
		}
		if len(steps) == 1 || !wait(ctx, repeat) {
			return
		}
	}
}

func wait(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
