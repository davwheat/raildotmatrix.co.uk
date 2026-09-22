package infotec

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

const (
	testW, testH = 256, 64
	tick         = 20 * time.Millisecond
)

// sizes are the sizes the board is drawn at: the LED panel, and raildotmatrix.co.uk, which draws it in the dots of
// its old web layout.
var sizes = [][2]int{{testW, testH}, {272, 70}}

func newTestBoard(t *testing.T) *Board {
	t.Helper()
	return newSizedBoard(t, testW, testH)
}

func newSizedBoard(t *testing.T, w, h int) *Board {
	t.Helper()
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Fatal(err)
	}
	return New(Config{Width: w, Height: h, Zone: zone})
}

// run drives the board through a fixture at 50 Hz for the given duration, sending any second view after two
// seconds, and returns how many ticks redrew.
func run(t *testing.T, b *Board, name string, d time.Duration, check func(now time.Time, drew bool, f *frame.Frame)) int {
	t.Helper()
	steps := fixtures.Steps(name)
	if steps == nil {
		t.Fatalf("unknown fixture %q", name)
	}
	f := frame.New(b.cfg.Width, b.cfg.Height)
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

// litOutside reports the first lit dot of f outside the given bands, as (x, y, true).
func litOutside(f *frame.Frame, bands ...[2]int) (int, int, bool) {
	for y := range f.H {
		inBand := false
		for _, b := range bands {
			if y >= b[0] && y < b[1] {
				inBand = true
			}
		}
		if inBand {
			continue
		}
		for x := range f.W {
			if f.At(x, y) != frame.Black {
				return x, y, true
			}
		}
	}
	return 0, 0, false
}

func TestFixturesStayWithinRows(t *testing.T) {
	for _, size := range sizes {
		for _, name := range fixtures.Names {
			b := newSizedBoard(t, size[0], size[1])
			g := b.geo
			h := font.PISTall.Height
			bands := [][2]int{
				{g.firstY, g.firstY + h}, {g.infoY, g.infoY + h}, {g.sepY, g.sepY + 1}, {g.secondY, g.secondY + h},
				{g.clockY, g.clockY + font.DotMatrixClock.Height},
			}
			messageBands := [][2]int{{g.lineY[0], g.lineY[0] + h}, {g.lineY[1], g.lineY[1] + h}, {g.lineY[2], g.lineY[2] + h}, bands[4]}
			run(t, b, name, 40*time.Second, func(now time.Time, _ bool, f *frame.Frame) {
				allowed := bands
				if b.mode != modeTrains {
					allowed = messageBands
				}
				if x, y, lit := litOutside(f, allowed...); lit {
					t.Fatalf("%dx%d %s at %v: dot lit at (%d,%d), outside every row", size[0], size[1], name, now.Sub(fixtures.Clock), x, y)
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
	// Only the clock's seconds change on a message screen.
	for _, name := range []string{"connecting", "no-departures", "stand-clear", "non-public-train"} {
		expectStill(t, newTestBoard(t), name, 5*time.Second, 6*time.Second)
	}
	// The service information page fits the row, so between its appearance at 0.7 s and the next page at
	// 8 s only the clock changes.
	expectStill(t, newTestBoard(t), "busy-board", 3*time.Second, 4*time.Second)
}

func TestFirstTrainChangeSlidesOut(t *testing.T) {
	b := newTestBoard(t)
	sawSlide := false
	run(t, b, "first-departs", 8*time.Second, func(now time.Time, _ bool, f *frame.Frame) {
		if b.mode != modeTrains || b.phase != phaseSlideOut {
			return
		}
		if b.last.first.dx > 0 && b.last.first.on {
			sawSlide = true
		}
		if b.last.info.on || b.last.lower[0].on || b.last.lower[1].on {
			t.Fatalf("at %v: info %v, lower %v/%v shown during the slide-out", now.Sub(fixtures.Clock),
				b.last.info.on, b.last.lower[0].on, b.last.lower[1].on)
		}
		g := b.geo
		if x, y, lit := litOutside(f, [2]int{g.firstY, g.firstY + font.PISTall.Height}, [2]int{g.sepY, g.sepY + 1},
			[2]int{g.clockY, g.clockY + font.DotMatrixClock.Height}); lit {
			t.Fatalf("at %v: dot lit at (%d,%d) during the slide-out", now.Sub(fixtures.Clock), x, y)
		}
	})
	if !sawSlide {
		t.Fatal("the first train changed without sliding out")
	}
	if b.content.rows[0].id != "bedford" || b.phase != phaseSteady {
		t.Fatalf("after the slide-out: first %q, phase %v", b.content.rows[0].id, b.phase)
	}
	if !b.steadyStart.Equal(fixtures.Clock.Add(2*time.Second + slideOutTotal*time.Millisecond)) {
		t.Fatalf("rows settled at %v", b.steadyStart.Sub(fixtures.Clock))
	}
}

func TestLastTrainSlidesOutBeforeNoServices(t *testing.T) {
	b := newTestBoard(t)
	sawSlide := false
	var messageAt time.Time
	run(t, b, "last-departs", 8*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
		switch {
		case b.mode == modeTrains && b.phase == phaseSlideOut && b.last.first.dx > 0:
			sawSlide = true
		case b.mode == modeNoServices && messageAt.IsZero():
			messageAt = now
		}
	})
	if !sawSlide {
		t.Fatal("the last train left without sliding out")
	}
	want := fixtures.Clock.Add(2*time.Second + slideOutTotal*time.Millisecond)
	if messageAt.Before(want) || messageAt.After(want.Add(tick)) {
		t.Fatalf("no-services message shown at %v, want %v", messageAt.Sub(fixtures.Clock), want.Sub(fixtures.Clock))
	}
}

func TestNewContentFadesInAfterSlideOut(t *testing.T) {
	for _, tc := range []struct {
		fixture string
		after   mode
	}{{"first-departs", modeTrains}, {"last-departs", modeNoServices}} {
		b := newTestBoard(t)
		end := fixtures.Clock.Add(2*time.Second + slideOutTotal*time.Millisecond)
		lastLevel := 0
		run(t, b, tc.fixture, 4*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
			e := now.Sub(end)
			switch {
			case e < 0:
				if b.last.level != fadeLevels {
					t.Fatalf("%s at %v: level %d before the fade-in", tc.fixture, now.Sub(fixtures.Clock), b.last.level)
				}
			case e >= arriveFade*time.Millisecond:
				if b.last.level != fadeLevels || b.last.mode != tc.after {
					t.Fatalf("%s at %v: level %d, mode %v after the fade-in", tc.fixture, now.Sub(fixtures.Clock), b.last.level, b.last.mode)
				}
			default:
				want := int(e.Milliseconds() * fadeLevels / arriveFade)
				if b.last.level != want || b.last.level < lastLevel {
					t.Fatalf("%s at %v: level %d, want %d", tc.fixture, now.Sub(fixtures.Clock), b.last.level, want)
				}
				lastLevel = b.last.level
			}
		})
	}
}

func TestTrainAppearsOnEmptyBoardWithoutAnimation(t *testing.T) {
	b := newTestBoard(t)
	f := frame.New(testW, testH)
	b.Update(model.View{Connected: true})
	b.Tick(fixtures.Clock, f)
	b.Update(fixtures.Steps("single-departure")[0])
	b.Tick(fixtures.Clock.Add(tick), f)
	if b.mode != modeTrains || b.phase != phaseSteady || !b.last.first.on || b.last.first.dx != 0 || b.last.level != fadeLevels {
		t.Fatalf("mode %v, phase %v, first row %+v", b.mode, b.phase, b.last.first)
	}
}

func TestLostConnectionBlanksAtOnce(t *testing.T) {
	b := newTestBoard(t)
	f := frame.New(testW, testH)
	b.Update(fixtures.Steps("single-departure")[0])
	b.Tick(fixtures.Clock, f)
	b.Update(model.View{})
	b.Tick(fixtures.Clock.Add(tick), f)
	if b.mode != modeNoServices {
		t.Fatalf("mode %v, want no services", b.mode)
	}
}

func TestInfoPagesForDividingTrain(t *testing.T) {
	b := newTestBoard(t)
	c := b.derive(fixtures.Steps("dividing-service")[0])
	want := []page{
		{"", "A Southern service formed of 8 coaches.", infoHold},
		{"Front 4 coaches:", "Gatwick Airport (19:56) and Horsham (20:05).", callingHold},
		{"Rear 4 coaches:", "Gatwick Airport (19:56), Horsham (20:05) and Littlehampton (20:20).", callingHold},
	}
	if len(c.pages) != len(want) {
		t.Fatalf("pages = %+v", c.pages)
	}
	for i := range want {
		if c.pages[i] != want[i] {
			t.Errorf("page %d = %+v, want %+v", i, c.pages[i], want[i])
		}
	}
	if len(c.rows[0].pages) != 2 || c.rows[0].pages[0] != "Horsham" || c.rows[0].pages[1] != "and Littlehampton" {
		t.Errorf("destination pages = %q", c.rows[0].pages)
	}
}

func TestPageCycleOrder(t *testing.T) {
	b := newTestBoard(t)
	var order []int
	run(t, b, "dividing-service", 60*time.Second, func(time.Time, bool, *frame.Frame) {
		if len(order) == 0 || order[len(order)-1] != b.infoPage {
			order = append(order, b.infoPage)
		}
	})
	want := []int{0, 1, 2, 0, 1, 2}
	if len(order) < len(want) {
		t.Fatalf("page order %v", order)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("page order %v, want a prefix of %v", order, want)
		}
	}
}

func TestPageAppearsAfterDelay(t *testing.T) {
	b := newTestBoard(t)
	var shownAt time.Time
	run(t, b, "busy-board", 2*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
		if b.last.info.on && shownAt.IsZero() {
			shownAt = now
		}
	})
	if got := shownAt.Sub(fixtures.Clock); got != pageAppearDelay*time.Millisecond {
		t.Fatalf("information page shown at %v, want %v", got, pageAppearDelay*time.Millisecond)
	}
	if b.last.info.dy != 0 {
		t.Fatalf("information page still rising after 2 s: dy %d", b.last.info.dy)
	}
}

// TestPagesFadeOut checks both fades on the busy board: the static information page steps down and goes at the
// end of its hold, and the "Calling at:" prefix does the same as soon as its list has scrolled off.
func TestPagesFadeOut(t *testing.T) {
	b := newTestBoard(t)
	var infoOffAt, prefixAloneAt, prefixOffAt time.Time
	infoLevels, prefixLevels := map[int]bool{}, map[int]bool{}
	run(t, b, "busy-board", 20*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
		info := b.last.info
		switch {
		case b.infoPage == 1 && info.on && info.prefix == "":
			infoLevels[info.faded] = true
		case b.infoPage == 1 && !info.on && len(infoLevels) > 0 && infoOffAt.IsZero():
			infoOffAt = now
		case info.prefix != "" && info.text == "" && b.info.phase == scrollGone:
			if prefixAloneAt.IsZero() {
				prefixAloneAt = now
			}
			prefixLevels[info.faded] = true
			if !info.on && prefixOffAt.IsZero() {
				prefixOffAt = now
			}
		}
	})
	// The test ticks at 50 Hz, so it sees at most 10 of the 12 steps.
	if len(infoLevels) < 8 || len(prefixLevels) < 8 {
		t.Fatalf("fade levels seen: information page %v, prefix %v", infoLevels, prefixLevels)
	}
	holdEnd := fixtures.Clock.Add(infoHold * time.Millisecond)
	if infoOffAt.Sub(holdEnd) != pageFade*time.Millisecond {
		t.Fatalf("information page went at %v, hold ended at %v", infoOffAt.Sub(fixtures.Clock), holdEnd.Sub(fixtures.Clock))
	}
	if prefixAloneAt.IsZero() || prefixOffAt.Sub(prefixAloneAt) > pageFade*time.Millisecond+tick {
		t.Fatalf("list gone at %v, prefix went at %v", prefixAloneAt.Sub(fixtures.Clock), prefixOffAt.Sub(fixtures.Clock))
	}
}

func TestCallingPointsScroll(t *testing.T) {
	b := newTestBoard(t)
	g := b.geo
	var prefixAt, moveAt time.Time
	lastX := 0
	run(t, b, "busy-board", 12*time.Second, func(now time.Time, _ bool, f *frame.Frame) {
		// The service information page is still fading while the calling page waits to appear.
		if b.infoPage != 1 || !b.last.info.on || b.last.info.prefix == "" {
			return
		}
		if prefixAt.IsZero() {
			prefixAt = now
			if b.last.info.prefix != "Calling at:" || b.last.info.clipX != g.destX {
				t.Fatalf("calling page %+v", b.last.info)
			}
		}
		if b.last.info.text != "" && moveAt.IsZero() {
			moveAt = now
			lastX = b.last.info.x
		}
		if lastX != 0 && b.last.info.x > lastX {
			t.Fatalf("at %v: list moved right, from %d to %d", now.Sub(fixtures.Clock), lastX, b.last.info.x)
		}
		lastX = b.last.info.x
		for x := range g.destX {
			for y := g.infoY; y < g.infoY+font.PISTall.Height; y++ {
				if x > font.PISTall.Width("Calling at:") && f.At(x, y) != frame.Black {
					t.Fatalf("at %v: list dot lit at (%d,%d), left of its area", now.Sub(fixtures.Clock), x, y)
				}
			}
		}
	})
	// The information page holds for 8 s; the calling page then appears after 0.5 s and moves after 1 s.
	if got := prefixAt.Sub(fixtures.Clock); got != (infoHold+pageAppearDelay)*time.Millisecond {
		t.Fatalf("calling points prefix shown at %v", got)
	}
	if got := moveAt.Sub(fixtures.Clock); got != (infoHold+scrollPauseAtEnds)*time.Millisecond {
		t.Fatalf("calling points started moving at %v", got)
	}
}

func TestETDText(t *testing.T) {
	b := newTestBoard(t)
	for _, tc := range []struct{ fixture, want string }{
		{"busy-board", "On time"}, {"delayed", "1955"}, {"unknown-delay", "Delayed"}, {"cancelled", "Cancelled"},
	} {
		if got := b.derive(fixtures.Steps(tc.fixture)[0]).rows[0].etd; got != tc.want {
			t.Errorf("%s: etd %q, want %q", tc.fixture, got, tc.want)
		}
	}
}

func TestCancelledFlashes(t *testing.T) {
	b := newTestBoard(t)
	levels := map[time.Duration]int{}
	run(t, b, "cancelled", 3*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
		if b.last.first.etd != "Cancelled" {
			t.Fatalf("at %v: ETD %q", now.Sub(fixtures.Clock), b.last.first.etd)
		}
		levels[now.Sub(fixtures.Clock)%(flashPeriod*time.Millisecond)] = b.last.first.etdLevel
	})
	// Linear keyframes: full brightness at the start of a cycle, half way out at 375 ms, dark at 750 ms, half way back
	// at 937.5 ms, and lit again from 1125 ms.
	for at, want := range map[time.Duration]int{0: fadeLevels, 380: 14, 760: 0, 940: 15, 1120: 29, 1140: fadeLevels, 1480: fadeLevels} {
		if got := levels[at*time.Millisecond]; got != want {
			t.Errorf("at %v into the cycle: level %d, want %d", at*time.Millisecond, got, want)
		}
	}
}

func TestLowerRowsSwap(t *testing.T) {
	b := newTestBoard(t)
	g := b.geo
	var swapAt, settledAt time.Time
	run(t, b, "busy-board", 26*time.Second, func(now time.Time, _ bool, _ *frame.Frame) {
		e := now.Sub(fixtures.Clock)
		switch {
		case e < swapInterval*time.Millisecond:
			if !b.last.lower[0].on || b.last.lower[1].on || b.last.lower[0].ordinal != "2nd" {
				t.Fatalf("at %v: lower rows %+v", e, b.last.lower)
			}
		case swapAt.IsZero():
			swapAt = now
		case b.last.lower[0].on && b.last.lower[1].on:
			if b.last.lower[0].dy >= 0 || b.last.lower[1].dy <= 0 {
				t.Fatalf("at %v: 2nd row dy %d (want up), 3rd row dy %d (want below)", e, b.last.lower[0].dy, b.last.lower[1].dy)
			}
		case settledAt.IsZero() && b.last.lower[1].on && b.last.lower[1].dy == 0:
			settledAt = now
		}
	})
	if got := swapAt.Sub(fixtures.Clock); got != swapInterval*time.Millisecond {
		t.Fatalf("swap began at %v", got)
	}
	if got := settledAt.Sub(swapAt); got < swapSlide*time.Millisecond || got > swapSlide*time.Millisecond+tick {
		t.Fatalf("3rd row settled %v after the swap began, want %v", got, swapSlide*time.Millisecond)
	}
	// The second swap, at 24 s, brings the 2nd train back down from above.
	if !b.last.lower[0].on || b.last.lower[1].on || b.last.lower[0].ordinal != "2nd" {
		t.Fatalf("after two swaps: %+v", b.last.lower)
	}
	if !b.swapStart.Equal(fixtures.Clock.Add(2*swapInterval*time.Millisecond)) || g.swapTravel != 13 {
		t.Fatalf("swap start %v, travel %d", b.swapStart.Sub(fixtures.Clock), g.swapTravel)
	}
}

func TestGeometry(t *testing.T) {
	g := newGeometry(testW, testH, 0)
	want := geometry{
		w: 256, h: 64, ch: 6, stdX: 23, colonCell: 3, timeW: 27, destX: 55, destW: 139, exptW: 28,
		firstY: 0, infoY: 17, sepY: 33, secondY: 38, infoSlide: 13, swapTravel: 13, lineY: [3]int{3, 20, 37},
		clockX: 97, clockY: 55, clockCell: 9, colon: 4, full: g.full,
	}
	if g != want {
		t.Fatalf("geometry\n got %+v\nwant %+v", g, want)
	}
}

func BenchmarkTickScrolling(b *testing.B) {
	board := New(Config{Width: testW, Height: testH})
	f := frame.New(testW, testH)
	board.Update(fixtures.Steps("busy-board")[0])
	// Ten seconds in, the calling points are scrolling; at 60 dots/s every 20 ms tick moves them a dot or two.
	now := fixtures.Clock.Add(10 * time.Second)
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
