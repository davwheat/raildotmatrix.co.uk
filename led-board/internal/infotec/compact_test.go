package infotec

import (
	"fmt"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestCompactLowerRowKeepsClockClear(t *testing.T) {
	for _, size := range sizes {
		b := New(Config{Width: size[0], Height: size[1], PlatformBox: "10A"})
		g := b.geo
		if !g.compact || g.sepY != g.clockY-2 || g.secondBand().Y1 > g.h || g.formationY+g.formationH >= g.sepY {
			t.Fatalf("invalid compact layout: %+v", g)
		}
		for _, etd := range []string{"On time", "Cancelled", "Delayed", "1234"} {
			for dy := -font.InfotecSmall.Height; dy <= font.InfotecSmall.Height; dy++ {
				f := frame.New(g.w, g.h)
				b.drawCompactRow(f, &rowScene{prefix: "6th", std: "1234", dest: "A very long destination via another station", etd: etd, etdLevel: fadeLevels, dy: dy}, board.White)
				if x, y, lit := litOutside(f, [2]int{g.secondY, g.secondBand().Y1}); lit {
					t.Fatalf("compact row escaped its band at (%d,%d)", x, y)
				}
				for y := range g.h {
					for x := g.clockX - 4; x < g.w; x++ {
						if f.At(x, y) != frame.Black {
							t.Fatalf("row overwrote clock or gap at (%d,%d)", x, y)
						}
					}
				}
			}
		}
	}
}

func TestServiceRotationUpToSix(t *testing.T) {
	for _, compact := range []bool{false, true} {
		for count := 1; count <= 6; count++ {
			b := New(Config{Width: 256, Height: 64, PlatformBox: "2", CompactLowerRow: &compact, ServiceCount: count, OrdinalFormat: board.OrdinalDot})
			v := fixtures.Steps("busy-board")[0]
			base := v.Services[0]
			v.Services = nil
			for i := range 7 {
				s := base
				s.ID = fmt.Sprint(i)
				v.Services = append(v.Services, s)
			}
			b.Update(v)
			f := frame.New(256, 64)
			b.Tick(fixtures.Clock, f)
			if len(b.content.rows) != count {
				t.Fatalf("selected %d services, got %d", count, len(b.content.rows))
			}
			for step := 0; step < 2*count; step++ {
				now := fixtures.Clock.Add(time.Duration(step)*swapInterval*time.Millisecond + time.Second)
				b.Tick(now, f)
				visible := 0
				for _, row := range b.last.lower {
					if row.on {
						visible++
						want := fmt.Sprintf("%d.", 2+step%max(1, count-1))
						if row.prefix != want {
							t.Fatalf("count %d step %d: got %s want %s", count, step, row.prefix, want)
						}
					}
				}
				if visible != min(1, count-1) {
					t.Fatalf("count %d: %d lower rows visible", count, visible)
				}
			}
			// Reducing the live list while its last row is selected must not
			// retain an out-of-range rotation index.
			v.Services = append([]model.Service(nil), v.Services[:2]...)
			b.Update(v)
			b.Tick(fixtures.Clock.Add(time.Hour), f)
		}
	}
}
