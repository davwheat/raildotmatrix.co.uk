package formats

import (
	"fmt"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestDeadlinesPreserveEveryVisibleFrame(t *testing.T) {
	for _, pixels := range []bool{false, true} {
		t.Run(fmt.Sprintf("pixel-deadlines-%t", pixels), func(t *testing.T) {
			testDeadlinesPreserveEveryVisibleFrame(t, pixels)
		})
	}
}
func testDeadlinesPreserveEveryVisibleFrame(t *testing.T, pixels bool) {
	for _, name := range Names {
		for i, config := range []Config{
			{Width: 256, Height: 64, ServiceCount: 6},
			{Width: 256, Height: 64, ServiceCount: 1},
			{Width: 193, Height: 36, ServiceCount: 2, Worldline: true},
			{Width: 272, Height: 70, PlatformBox: true, SmallScrollingText: true, ScrollSpeed: 77},
			{Width: 128, Height: 32, ClockStyle: "small-seconds"},
			{Width: 32, Height: 8},
		} {
			for _, fixture := range fixtures.Names {
				t.Run(fmt.Sprintf("%s/%d/%s", name, i, fixture), func(t *testing.T) {
					regular, _ := New(name, config)
					scheduled, _ := New(name, config)
					nextDeadline := scheduled.(board.NextTicker).NextTick
					if pixels {
						nextDeadline = scheduled.(board.PixelTicker).NextPixelTick
					}
					want, got := frame.New(config.Width, config.Height), frame.New(config.Width, config.Height)
					steps := fixtures.Steps(fixture)
					var next time.Time
					calls := 0
					for tick := range 12000 {
						now := fixtures.Clock.Add(3*time.Millisecond + time.Duration(tick)*5*time.Millisecond)
						if tick%2400 == 0 {
							view := steps[(tick/2400)%len(steps)]
							regular.Update(view)
							scheduled.Update(view)
							next = time.Time{} // A feed update interrupts an idle wait.
						}
						regular.Tick(now, want)
						if next.IsZero() || !now.Before(next) {
							scheduled.Tick(now, got)
							next = nextDeadline(now)
							calls++
						}
						if !got.Equal(want) {
							t.Fatalf("tick %d: postponed a visible change until %s", tick, next)
						}
					}
					if fixture == "no-departures" && calls >= 12000/3 {
						t.Fatalf("idle screen still made %d ticks", calls)
					}
				})
			}
		}
	}
}
