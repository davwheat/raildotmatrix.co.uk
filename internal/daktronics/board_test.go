package daktronics

import (
	"testing"
	"time"

	"github.com/davwheat/led-departure-board/internal/fixtures"
	"github.com/davwheat/led-departure-board/internal/frame"
	"github.com/davwheat/led-departure-board/internal/model"
)

const (
	testW, testH = 256, 64
	tick         = 20 * time.Millisecond
)

func newTestBoard(t *testing.T, worldline bool) *Board {
	t.Helper()
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Fatal(err)
	}
	return New(Config{Width: testW, Height: testH, Zone: zone, WorldlinePowered: worldline})
}

// run drives the board through a fixture at 50 Hz for the given duration, sending any second view after two
// seconds, and returns how many ticks redrew.
func run(t *testing.T, b *Board, name string, d time.Duration, check func(now time.Time, drew bool, f *frame.Frame)) int {
	t.Helper()
	steps := fixtures.Steps(name)
	if steps == nil {
		t.Fatalf("unknown fixture %q", name)
	}
	f := frame.New(testW, testH)
	b.Update(steps[0])
	redraws := 0
	for now := fixtures.Clock; now.Before(fixtures.Clock.Add(d)); now = now.Add(tick) {
		if len(steps) > 1 && now.Equal(fixtures.Clock.Add(2*time.Second)) {
			b.Update(steps[1])
		}
		drew := b.Tick(now, f)
		if drew {
			redraws++
		}
		if check != nil {
			check(now, drew, f)
		}
	}
	return redraws
}

func TestFixturesStayWithinRows(t *testing.T) {
	for _, worldline := range []bool{false, true} {
		for _, name := range fixtures.Names {
			b := newTestBoard(t, worldline)
			g := b.geo
			run(t, b, name, 40*time.Second, func(now time.Time, _ bool, f *frame.Frame) {
				for y := range f.H {
					if y%g.rowH < g.rowH-2 {
						continue
					}
					for x := range f.W {
						if f.At(x, y) != frame.Black {
							t.Fatalf("%s (worldline=%v) at %v: dot lit at (%d,%d), in the gap below row %d",
								name, worldline, now.Sub(fixtures.Clock), x, y, y/g.rowH)
						}
					}
				}
			})
		}
	}
}

// expectStill drives the board to the window [from, to) and fails if any tick inside it redraws.
func expectStill(t *testing.T, b *Board, name string, from, to time.Duration) {
	t.Helper()
	run(t, b, name, to, func(now time.Time, drew bool, _ *frame.Frame) {
		e := now.Sub(fixtures.Clock)
		if e > from && e < to && drew {
			t.Fatalf("%s: tick at %v redrew a still board", name, e)
		}
	})
}

func TestStillBoardDoesNotRedraw(t *testing.T) {
	for _, name := range []string{"connecting", "no-departures", "stand-clear", "non-public-train"} {
		// The clock flips for half a second after each change, so the second half of a second is still.
		expectStill(t, newTestBoard(t, false), name, 5500*time.Millisecond, 6*time.Second)
	}
}

func TestPausedScrollDoesNotRedraw(t *testing.T) {
	// After the 1.6 s entrance and the 1 s hidden pause, the prefix drops for 0.4 s and then rests for 1.5 s,
	// and row 3 settled 0.4 s after the entrance; from 3.5 s only the clock's second changes at 4 s.
	expectStill(t, newTestBoard(t, false), "busy-board", 3500*time.Millisecond, 4*time.Second)
}

func TestFirstTrainChangeClearsDown(t *testing.T) {
	b := newTestBoard(t, false)
	sawSpinner, sawEntrance := false, false
	run(t, b, "first-departs", 8*time.Second, func(time.Time, bool, *frame.Frame) {
		switch {
		case b.mode == modeTrains && b.phase == phaseClearDown && b.last.spinner:
			sawSpinner = true
		case b.mode == modeTrains && b.phase == phaseSlideIn && b.last.first.dy > 0:
			sawEntrance = true
		}
	})
	if !sawSpinner || !sawEntrance {
		t.Fatalf("clear-down spinner seen %v, entrance seen %v", sawSpinner, sawEntrance)
	}
	if b.content.rows[0].id != "bedford" || b.phase != phaseSteady {
		t.Fatalf("after the clear-down: first %q, phase %v", b.content.rows[0].id, b.phase)
	}
}

func TestLastTrainClearsDownBeforeNoServices(t *testing.T) {
	b := newTestBoard(t, false)
	sawSpinner := false
	var messageAt time.Time
	run(t, b, "last-departs", 8*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
		switch {
		case b.mode == modeTrains && b.phase == phaseClearDown && b.last.spinner:
			sawSpinner = true
		case b.mode == modeNoServices && messageAt.IsZero():
			messageAt = now
		}
	})
	if !sawSpinner {
		t.Fatal("the last train left without a clear-down")
	}
	want := fixtures.Clock.Add(2*time.Second + clearDownTotal*time.Millisecond)
	if messageAt.Before(want) || messageAt.After(want.Add(tick)) {
		t.Fatalf("no-services message shown at %v, want %v", messageAt.Sub(fixtures.Clock), want.Sub(fixtures.Clock))
	}
}

func TestAlterationFlashesThenRedraws(t *testing.T) {
	b := newTestBoard(t, false)
	lit, dark := 0, 0
	run(t, b, "platform-alteration", 9*time.Second, func(time.Time, bool, *frame.Frame) {
		if b.mode != modeAlteration {
			return
		}
		if b.last.lit {
			lit++
		} else {
			dark++
		}
	})
	if lit != 150 || dark != 150 {
		t.Fatalf("alteration lit for %d ticks and dark for %d, want 150 each", lit, dark)
	}
	if b.mode != modeTrains || b.content.rows[0].id != "bedford" {
		t.Fatalf("after the alteration: mode %v, first %q", b.mode, b.content.rows[0].id)
	}
}

func TestWarningOutranksAlteration(t *testing.T) {
	b := newTestBoard(t, false)
	f := frame.New(testW, testH)
	steps := fixtures.Steps("platform-alteration")
	b.Update(steps[0])
	b.Tick(fixtures.Clock, f)
	b.Update(steps[1])
	b.Tick(fixtures.Clock.Add(tick), f)
	if b.mode != modeAlteration {
		t.Fatalf("mode %v, want alteration", b.mode)
	}
	warned := steps[1]
	warned.Notice = model.StandClear
	b.Update(warned)
	b.Tick(fixtures.Clock.Add(2*tick), f)
	if b.mode != modeWarning {
		t.Fatalf("mode %v, want warning", b.mode)
	}
}

func TestTripleLine(t *testing.T) {
	b := newTestBoard(t, false)
	run(t, b, "triple-line", 3*time.Second, nil)
	first := b.content.rows[0]
	if first.line1 != "Horsham, Littlehampton &" || first.line2 != "Bognor Regis" {
		t.Fatalf("wrapped as %q / %q", first.line1, first.line2)
	}
	if b.last.infoRow != 2 || b.last.third.on {
		t.Fatalf("info on row %d (want 2), third row shown %v (want false)", b.last.infoRow, b.last.third.on)
	}
}

func TestInfoPagesForDividingTrain(t *testing.T) {
	b := newTestBoard(t, false)
	c := b.derive(fixtures.Steps("dividing-service")[0])
	want := []page{
		{"Southern", " service. Formed of 8 coaches."},
		{"Front 4 coaches calling at:", " Gatwick Airport, HORSHAM."},
		{"Rear 4 coaches calling at:", " Gatwick Airport, Horsham, LITTLEHAMPTON."},
	}
	if len(c.pages) != len(want) {
		t.Fatalf("pages = %+v", c.pages)
	}
	for i := range want {
		if c.pages[i] != want[i] {
			t.Errorf("page %d = %+v, want %+v", i, c.pages[i], want[i])
		}
	}
}

func BenchmarkTickScrolling(b *testing.B) {
	board := New(Config{Width: testW, Height: testH})
	f := frame.New(testW, testH)
	board.Update(fixtures.Steps("busy-board")[0])
	// Six seconds in, the information row is scrolling; at 48 dots/s nearly every 20 ms tick moves it a dot.
	now := fixtures.Clock.Add(6 * time.Second)
	board.Tick(now, f)
	b.ReportAllocs()
	b.ResetTimer()
	redraws := 0
	for range b.N {
		now = now.Add(tick)
		if board.Tick(now, f) {
			redraws++
		}
	}
	b.ReportMetric(float64(redraws)/float64(b.N), "redraws/tick")
}
