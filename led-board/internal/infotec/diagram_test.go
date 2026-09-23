package infotec

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

var separateClock = false

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
	for y, left := range []int{4, 4, 3, 3, 2, 2, 1, 1, 0, 0, 1} {
		for x := 0; x <= 4; x++ {
			if lit := f.At(x, y) != frame.Black; lit != (x >= left) {
				t.Fatalf("cab pixel (%d,%d): must be filled from x=%d", x, y, left)
			}
		}
		if y > 0 && y < 10 && f.At(5, y) != frame.Black {
			t.Fatalf("cab intrudes into the first coach at row %d", y)
		}
	}
	for _, x := range []int{18, 32} {
		want := board.White
		if x == 32 {
			want = frame.Black
		}
		if f.At(x, 0) != want || f.At(x, 10) != want {
			t.Error("last coach must have square left corners and rounded right corners")
		}
		for y := 1; y < 10; y++ {
			if f.At(x, y) != board.White {
				t.Errorf("last coach edge missing at (%d,%d)", x, y)
			}
		}
	}
}

func TestFormationHollowCoachWidths(t *testing.T) {
	for _, width := range []int{49, 160, 224, 256, 272} {
		for _, length := range []int{1, 4, 8, 16} {
			f := frame.New(width, 11)
			drawFormation(f, 0, 0, width, f.H, length, board.White)
			// At mid-height, count dark dots between the filled cab and each
			// successive divider. Exterior space is not a coach interior.
			started, dark, coaches, interior := false, 0, 0, 0
			for x := range width {
				if f.At(x, 5) == frame.Black {
					if started {
						dark++
					}
					continue
				}
				started = true
				if dark > 0 {
					if coaches == 0 {
						interior = dark
					} else if dark != interior {
						t.Fatalf("width %d, length %d: coach %d interior is %d, first coach is %d", width, length, coaches+1, dark, interior)
					}
					coaches++
					dark = 0
				}
			}
			if coaches != length {
				t.Fatalf("width %d: drew %d hollow coaches, want %d", width, coaches, length)
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
		for _, platform := range []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10A"} {
			b := New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], PlatformBox: platform})
			g := b.geo
			f := frame.New(size[0], size[1])
			b.drawPlatformBox(f, board.White)
			label := frame.New(size[0], size[1])
			labelY := 2
			if size[1] == 70 {
				labelY = 5
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
			for y := labelY + font.PISTall.Baseline; y < labelY+font.PISTall.Baseline+6; y++ {
				for x := 1; x < g.boxW-1; x++ {
					if f.At(x, y) != frame.Black {
						t.Fatalf("%q: gap below Plat must have six blank rows", platform)
					}
				}
			}
			for y := labelY + font.PISTall.Baseline + 6; y < g.sepY; y++ {
				for x := 1; x < g.boxW-1; x++ {
					if f.At(x, y) != frame.Black {
						left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
					}
				}
			}
			// An odd spare dot belongs on the left: half-dot positions round right.
			if delta := left - (g.boxW - 1 - right); delta < 0 || delta > 1 || bottom-top+1 != font.InfotecPlatform.Height {
				t.Errorf("%q: enlarged number is not centred: bounds (%d,%d)-(%d,%d), box width %d", platform, left, top, right, bottom, g.boxW)
			}
		}
	}
}

func TestServicePlatformBoxFollowsFirstTrain(t *testing.T) {
	for _, size := range sizes {
		b := New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], ServicePlatformBox: true})
		f := frame.New(size[0], size[1])
		v := fixtures.Steps("busy-board")[0]
		now := fixtures.Clock
		// Updates at the same clock instant must redraw solely because the
		// platform changed, including a hidden platform becoming blank.
		for _, platform := range []string{"2", "10A", "", "10A"} {
			v.Services[0].Platform = platform
			b.Update(v)
			if !b.Tick(now, f) || b.last.platform != platform {
				t.Fatalf("platform change to %q did not redraw the box", platform)
			}
			if b.geo.boxW != max(font.PISTall.Width("Plat"), font.InfotecPlatform.Width(platform))+6 {
				t.Fatalf("box does not fit platform %q", platform)
			}
			want := frame.New(size[0], size[1])
			b.drawPlatformBox(want, b.cfg.Colour)
			for y := 0; y <= b.geo.sepY; y++ {
				for x := 0; x < b.geo.boxW; x++ {
					if f.At(x, y) != want.At(x, y) {
						t.Fatalf("box for %q overwritten at (%d,%d)", platform, x, y)
					}
				}
			}
		}
		v.Services = v.Services[1:]
		v.Services[0].Platform = "3"
		b.Update(v)
		b.Tick(now.Add(time.Second), f)
		if b.phase != phaseSlideOut || b.last.platform != "10A" {
			t.Fatal("outgoing train must retain its own platform during the slide")
		}
		b.Tick(now.Add(time.Second+slideOutTotal*time.Millisecond), f)
		if b.last.platform != "3" {
			t.Fatal("box did not switch to the new first service")
		}
		if b.info.x0 < b.geo.infoX {
			t.Fatal("information scroller retained the previous box's geometry")
		}
	}
}

func TestSamePlatformBoxDoesNotFadeBetweenTrains(t *testing.T) {
	for _, dynamic := range []bool{false, true} {
		cfg := Config{CompactLowerRow: &separateClock, Width: 256, Height: 64, PlatformBox: "2", ServicePlatformBox: dynamic}
		if dynamic {
			cfg.PlatformBox = ""
		}
		b := New(cfg)
		f := frame.New(256, 64)
		v := fixtures.Steps("busy-board")[0]
		for i := range v.Services {
			v.Services[i].Platform = "2"
		}
		b.Update(v)
		b.Tick(fixtures.Clock, f)
		want := frame.New(256, 64)
		b.drawPlatformBox(want, b.cfg.Colour)
		v.Services = v.Services[1:]
		b.Update(v)
		start := fixtures.Clock.Add(time.Second)
		sawFade := false
		for elapsed := time.Duration(0); elapsed < 3*time.Second; elapsed += tick {
			b.Tick(start.Add(elapsed), f)
			sawFade = sawFade || b.last.level < fadeLevels
			for y := 0; y <= b.geo.sepY; y++ {
				for x := 0; x < b.geo.boxW; x++ {
					if f.At(x, y) != want.At(x, y) {
						t.Fatalf("dynamic=%v: platform box changed at (%d,%d), %v into transition", dynamic, x, y, elapsed)
					}
				}
			}
		}
		if !sawFade {
			t.Fatal("test did not exercise the service fade-in")
		}
	}
}

func TestDifferentPlatformBoxFadesWithNewTrain(t *testing.T) {
	b := New(Config{CompactLowerRow: &separateClock, Width: 256, Height: 64, ServicePlatformBox: true})
	f := frame.New(256, 64)
	v := fixtures.Steps("busy-board")[0]
	v.Services[0].Platform = "2"
	b.Update(v)
	b.Tick(fixtures.Clock, f)
	v.Services = v.Services[1:]
	v.Services[0].Platform = "3"
	b.Update(v)
	start := fixtures.Clock.Add(time.Second)
	b.Tick(start, f)
	b.Tick(start.Add(slideOutTotal*time.Millisecond+100*time.Millisecond), f)
	if b.last.platform != "3" || b.last.steadyPlatform || b.last.level == fadeLevels {
		t.Fatal("new platform must join the incoming train's fade")
	}
	if f.At(0, 0) != board.Scale(b.cfg.Colour, b.last.level, fadeLevels) {
		t.Fatal("new platform box brightness differs from incoming train")
	}
}

func TestPlatformBoxServiceColumnsAlign(t *testing.T) {
	for _, size := range sizes {
		for _, platform := range []string{"2", "10A"} {
			for _, ordinal := range []string{"2nd", "3rd"} {
				b := New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], PlatformBox: platform})
				g := b.geo
				f := frame.New(size[0], size[1])
				r := rowScene{on: true, std: "1234", dest: "London Victoria", etd: "On time", etdLevel: fadeLevels}
				s := scene{first: r, lower: [5]rowScene{r}}
				s.lower[0].prefix = ordinal
				b.renderTrains(f, &s, board.White)
				for y := range font.PISTall.Height {
					for x := g.infoX; x < g.w; x++ {
						if f.At(x, g.firstY+y) != f.At(x, g.secondY+y) {
							t.Fatalf("platform %s: %s service columns differ at (%d,%d)", platform, ordinal, x, y)
						}
					}
				}
				want := frame.New(g.boxW, font.PISTall.Height)
				font.PISTall.Draw(want, (g.boxW-font.PISTall.Width(ordinal))/2, 0, ordinal, board.White)
				for y := range want.H {
					for x := range want.W {
						if f.At(x, g.secondY+y) != want.At(x, y) {
							t.Fatalf("platform %s: %s is not centred below the box", platform, ordinal)
						}
					}
				}
			}
		}
	}
}

func TestPlatformBoxAlignmentCanBeDisabled(t *testing.T) {
	for _, size := range sizes {
		for _, platform := range []string{"2", "10A"} {
			align := false
			b := New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], PlatformBox: platform, AlignPlatformRows: &align})
			aligned := New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], PlatformBox: platform})
			g := b.geo
			for _, ordinal := range []string{"2nd", "3rd"} {
				r := rowScene{on: true, prefix: ordinal, std: "1234", dest: "London Victoria", etd: "On time", etdLevel: fadeLevels}
				s := scene{first: r, lower: [5]rowScene{r}}
				got, want := frame.New(g.w, g.h), frame.New(g.w, g.h)
				b.renderTrains(got, &s, board.White)
				aligned.renderTrains(want, &s, board.White)
				legacy := newGeometry(g.w, g.h, b.cfg.RowPrefix)
				for y := g.secondY; y < g.secondY+font.PISTall.Height; y++ {
					for x := range g.w {
						want.Set(x, y, frame.Black)
					}
				}
				b.drawRow(want, &r, &legacy, g.secondY, g.secondBand(), board.White)
				for y := range g.h {
					for x := range g.w {
						if got.At(x, y) != want.At(x, y) {
							t.Fatalf("platform %s %s: disabling alignment must restore only the lower row; differs at (%d,%d)", platform, ordinal, x, y)
						}
					}
				}
			}
		}
	}
}

func TestPlatformBoxSurvivesScrollingAndDeparture(t *testing.T) {
	for _, size := range sizes {
		b := New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], PlatformBox: "2"})
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
		b = New(Config{CompactLowerRow: &separateClock, Width: size[0], Height: size[1], PlatformBox: "2"})
		run(t, b, "first-departs", 3*time.Second, func(_ time.Time, _ bool, f *frame.Frame) {
			if b.phase == phaseSlideOut && f.At(0, 8) != board.Amber {
				t.Fatal("platform box disappeared with the outgoing train")
			}
		})
	}
}
