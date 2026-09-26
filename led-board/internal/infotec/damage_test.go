package infotec

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestPartialRenderingMatchesFullFrames(t *testing.T) {
	compact := false
	for _, cfg := range []Config{
		{Width: 256, Height: 64, ServiceCount: 6},
		{Width: 272, Height: 70, ServicePlatformBox: true},
		{Width: 256, Height: 64, PlatformBox: "10A", SmallScrollingText: true},
		{Width: 256, Height: 64, ServicePlatformBox: true, CompactLowerRow: &compact, ClockStyle: "small-seconds", FormationCount: "carriages"},
		{Width: 128, Height: 32}, {Width: 32, Height: 8},
	} {
		for _, fixture := range fixtures.Names {
			b := New(cfg)
			got, want := frame.New(cfg.Width, cfg.Height), frame.New(cfg.Width, cfg.Height)
			steps := fixtures.Steps(fixture)
			for tick := range 1300 {
				if tick%200 == 0 {
					b.Update(steps[(tick/200)%len(steps)])
				}
				now := fixtures.Clock.Add(time.Duration(tick) * 37 * time.Millisecond)
				b.Tick(now, got)
				b.render(want, &b.last)
				if !got.Equal(want) {
					t.Fatalf("%dx%d %s tick %d: partial rendering differs", cfg.Width, cfg.Height, fixture, tick)
				}
			}
		}
	}
}
