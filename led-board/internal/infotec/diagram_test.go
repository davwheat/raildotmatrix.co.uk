package infotec

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestFormationCoachCount(t *testing.T) {
	for _, width := range []int{160, 224, 256, 272} {
		for _, length := range []int{-1, 0, 1, 4, 8, 12, 16} {
			f := frame.New(width, 11)
			drawFormation(f, 0, 0, width, f.H, length, board.White)
			// Count separate strokes: the filled nose and each coach boundary.
			boundaries := 0
			previous := false
			for x := range width {
				lit := f.At(x, 5) != frame.Black
				if lit && !previous {
					boundaries++
				}
				previous = lit
			}
			want := 0
			if length > 0 {
				want = length + 1
			}
			if boundaries != want {
				t.Errorf("width %d, length %d: %d boundaries, want %d", width, length, boundaries, want)
			}
		}
	}
}

func TestFormationCabAndLastCoach(t *testing.T) {
	f := frame.New(40, 11)
	drawFormation(f, 0, 0, f.W, f.H, 2, board.White)
	for y, left := range []int{4, 4, 2, 2, 0, 0, 0, 0, 0, 0, 1} {
		for x := 0; x <= 6; x++ {
			if lit := f.At(x, y) != frame.Black; lit != (x >= left) {
				t.Fatalf("cab pixel (%d,%d): must be filled from x=%d", x, y, left)
			}
		}
	}
	for _, x := range []int{14, 28} {
		if f.At(x, 0) != frame.Black || f.At(x, 10) != frame.Black {
			t.Error("last coach corners must be unlit")
		}
		for y := 1; y < 10; y++ {
			if f.At(x, y) != board.White {
				t.Errorf("last coach edge missing at (%d,%d)", x, y)
			}
		}
	}
}

func TestFormationChangesWithTrainLength(t *testing.T) {
	for _, size := range sizes {
		b := newSizedBoard(t, size[0], size[1])
		f := frame.New(size[0], size[1])
		view := fixtures.Steps("single-departure")[0]
		now := fixtures.Clock
		for _, length := range []int{8, 4, 0, 12, -1} {
			view.Services[0].Length = length
			b.Update(view)
			if !b.Tick(now, f) {
				t.Fatalf("length change to %d did not redraw", length)
			}
			if b.last.formation != max(0, length) {
				t.Errorf("formation length = %d, want %d", b.last.formation, length)
			}
			g := b.geo
			if length > 0 {
				if g.formationY < g.infoY+font.PISTall.Height || g.formationY+g.formationH >= g.sepY || g.secondY+font.PISTall.Height > g.clockY {
					t.Fatalf("formation overlaps a text row: %+v", g)
				}
				if f.At(1, g.formationY+g.formationH-1) != b.cfg.Colour {
					t.Error("formation not drawn")
				}
			} else if g.formationH != 0 || g.sepY != 33 {
				t.Error("unknown length did not restore the ordinary layout")
			}
			now = now.Add(time.Second)
		}
	}
}

func TestPlatformBoxLabelAndNumber(t *testing.T) {
	for _, size := range sizes {
		for _, platform := range []string{"2", "10", "10A"} {
			b := New(Config{Width: size[0], Height: size[1], PlatformBox: platform})
			g := b.geo
			f := frame.New(size[0], size[1])
			b.drawPlatformBox(f, board.White)
			label := frame.New(size[0], size[1])
			labelY := 5
			if size[1] == 70 {
				labelY = 8
			}
			font.PISTall.Draw(label, (g.boxW-font.PISTall.Width("Plat"))/2, labelY, "Plat", board.White)
			for y := labelY; y < labelY+font.PISTall.Baseline; y++ {
				for x := 1; x < g.boxW-1; x++ {
					if f.At(x, y) != label.At(x, y) {
						t.Fatalf("%q: Plat must be centred above the number, slightly above the box centre", platform)
					}
				}
			}
			left, right, top, bottom := g.boxW, 0, g.sepY, 0
			for y := labelY + font.PISTall.Baseline + 3; y < g.sepY; y++ {
				for x := 1; x < g.boxW-1; x++ {
					if f.At(x, y) != frame.Black {
						left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
					}
				}
			}
			if delta := left - (g.boxW - 1 - right); delta < -1 || delta > 1 || bottom-top+1 != font.InfotecLarge.Height {
				t.Errorf("%q: enlarged number is not centred: bounds (%d,%d)-(%d,%d), box width %d", platform, left, top, right, bottom, g.boxW)
			}
		}
	}
}

func TestPlatformBoxSurvivesScrollingAndDeparture(t *testing.T) {
	for _, size := range sizes {
		b := New(Config{Width: size[0], Height: size[1], PlatformBox: "2"})
		if b.geo.infoX-b.geo.boxW != 2 {
			t.Fatal("platform box must be two dots from the service information")
		}
		want := frame.New(size[0], size[1])
		b.drawPlatformBox(want, board.Amber)
		run(t, b, "busy-board", 35*time.Second, func(now time.Time, _ bool, f *frame.Frame) {
			for y := 0; y <= b.geo.sepY; y++ {
				for x := b.geo.boxW; x < b.geo.infoX; x++ {
					if f.At(x, y) != frame.Black {
						t.Fatalf("platform box gap overwritten at (%d,%d), %v", x, y, now.Sub(fixtures.Clock))
					}
				}
			}
			for y := 0; y < b.geo.sepY; y++ {
				for x := 0; x < b.geo.boxW; x++ {
					if f.At(x, y) != want.At(x, y) {
						t.Fatalf("platform box overwritten at (%d,%d), %v", x, y, now.Sub(fixtures.Clock))
					}
				}
			}
		})
		// The platform remains fixed when the first train slides away.
		b = New(Config{Width: size[0], Height: size[1], PlatformBox: "2"})
		run(t, b, "first-departs", 3*time.Second, func(_ time.Time, _ bool, f *frame.Frame) {
			if b.phase == phaseSlideOut && f.At(0, 8) != board.Amber {
				t.Fatal("platform box disappeared with the outgoing train")
			}
		})
	}
}
