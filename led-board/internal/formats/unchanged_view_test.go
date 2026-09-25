package formats

import (
	"fmt"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Suppressing a hidden feed delta must preserve ongoing animations as well as
// the projected data. Compare every frame against repeated identical updates.
func TestUnchangedViewsPreserveAnimationFrames(t *testing.T) {
	for _, name := range Names {
		for _, fixture := range append(append([]string(nil), fixtures.Names...), "detailed-formation") {
			for _, count := range []int{1, 3, 6} {
				t.Run(fmt.Sprintf("%s/%s/%d", name, fixture, count), func(t *testing.T) {
					cfg := Config{Width: 256, Height: 64, ServiceCount: count}
					repeated, _ := New(name, cfg)
					once, _ := New(name, cfg)
					want, got := frame.New(256, 64), frame.New(256, 64)
					steps := fixtures.Steps(fixture)
					view := steps[0]
					// Alterations are events, not an unchanged state to repeat.
					view.Alterations = nil
					once.Update(view)
					for tick := range 1500 {
						now := fixtures.Clock.Add(time.Duration(tick) * 20 * time.Millisecond)
						if tick%2 == 0 {
							repeated.Update(view)
						}
						repeated.Tick(now, want)
						once.Tick(now, got)
						if !got.Equal(want) {
							t.Fatalf("suppressing an unchanged view changed frame %d", tick)
						}
					}
				})
			}
		}
	}
}
