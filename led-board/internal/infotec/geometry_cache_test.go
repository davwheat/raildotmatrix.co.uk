package infotec

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Layout reuse must follow both the outgoing train during a slide and the new
// train afterwards, including changes in platform width and formation height.
func TestGeometryReuseThroughUpdates(t *testing.T) {
	for _, compact := range []bool{false, true} {
		cfg := Config{Width: 256, Height: 64, ServicePlatformBox: true, CompactLowerRow: &compact}
		cached, reference := New(cfg), New(cfg)
		got, want := frame.New(256, 64), frame.New(256, 64)
		for step := range 900 {
			if step%180 == 0 {
				fixture := []string{"busy-board", "detailed-formation", "no-departures", "single-departure", "busy-board"}[step/180]
				view := fixtures.Steps(fixture)[0]
				if len(view.Services) > 0 {
					view.Services[0].Platform = []string{"2", "10A", "", "", "1"}[step/180]
				}
				cached.Update(view)
				reference.Update(view)
			}
			now := fixtures.Clock.Add(time.Duration(step) * 50 * time.Millisecond)
			// Force the reference to calculate layout from scratch on every tick.
			reference.geoPlatform = "\x00"
			changed := cached.Tick(now, got)
			if changed != reference.Tick(now, want) || cached.geo != reference.geo || !got.Equal(want) {
				t.Fatalf("compact=%v step=%d: reused layout differs from a fresh layout", compact, step)
			}
		}
	}
}
