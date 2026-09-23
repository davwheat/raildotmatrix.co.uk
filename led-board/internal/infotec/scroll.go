package infotec

import "time"

// DefaultScrollSpeed is the scroll speed in dots per second. The web scrolls at 550 px/s, which is 77 dots/s at
// 7.17 px per dot, but that reads as too fast on the physical panel, whose dots are larger.
const DefaultScrollSpeed = 60

// Timings of SlideyScrollText.tsx, TrainServiceAdditionalInfo.tsx and trainServiceAdditionalInfo.scss, in
// milliseconds.
const (
	scrollPauseAtEnds = 1000
	// infoHold and callingHold are how long a page that fits its row stays before the next one.
	infoHold    = 8000
	callingHold = 5000
	// pageAppearDelay is the 0.5 s transition delay before a selected page is visible.
	pageAppearDelay = 500
	// infoSlideIn is the info-in animation that lifts the service-information page into its row.
	infoSlideIn = 200
	// pageFade is the linear opacity transition of a page going out, and fadeSteps how many brightness steps
	// it takes: one per refresh at the board's default 60 Hz.
	pageFade  = 200
	fadeSteps = 12
	// prefixSpacing is the room between a calling-point prefix wider than the destination column and its list.
	prefixSpacing = 2
)

type scrollPhase uint8

const (
	// scrollWaiting is the pause with the text parked off the right edge of its area, or the whole showing of
	// a text that fits.
	scrollWaiting scrollPhase = iota
	// scrollMoving is the text travelling left until it has left its area.
	scrollMoving
	// scrollGone is the pause after the text has gone, before the next page.
	scrollGone
)

// scroller is a port of SlideyScrollText: a text that fits its area is shown for a fixed time; one that does
// not starts off the area's right edge, waits, scrolls left until it is off the left edge, and waits again.
// The prefix stays put at the left edge of the row.
type scroller struct {
	prefix, text string
	// x0 is the left edge of the area the text scrolls through and outerW its width.
	x0, outerW, textW int
	static            bool
	hold              int64
	// speed is the scroll speed in dots per second.
	speed int
	// slide is how far the service-information page rises into the row when shown, or 0 for a calling page.
	slide int
	phase scrollPhase
	// selected is when the page was chosen and start when the current phase began.
	selected, start time.Time
	// fading is the page that finished last, shown fading while the next one waits to appear, and fadeStart
	// when it finished.
	fading    scrollScene
	fadeStart time.Time
}

func (s *scroller) reset(p page, g *geometry, now time.Time) {
	text := g.infoFace()
	s.prefix, s.text = p.prefix, p.text
	s.textW = text.Width(p.text)
	s.x0 = g.infoX
	if p.prefix != "" {
		// The list lines up with the destination column unless the prefix is too wide for that (min-width and
		// padding-right in the SCSS).
		s.x0 = max(g.infoDestX, g.infoX+text.Width(p.prefix)+prefixSpacing)
	}
	s.outerW = g.w - s.x0
	s.static = s.textW <= s.outerW
	// A page that fits its row rises into place; a list that has to scroll enters from the right instead.
	s.slide = 0
	if s.static || p.prefix == "" {
		s.slide = g.infoSlide
	}
	s.hold = p.hold
	s.phase = scrollWaiting
	s.selected, s.start = now, now
}

func (s *scroller) duration() int64 {
	switch {
	case s.static:
		return s.hold
	case s.phase == scrollMoving:
		return int64(s.textW+s.outerW) * 1000 / int64(s.speed)
	default:
		return scrollPauseAtEnds
	}
}

// advance moves through the phases that have elapsed by now and reports whether the page finished.
func (s *scroller) advance(now time.Time) bool {
	for {
		d := s.duration()
		if now.Sub(s.start).Milliseconds() < d {
			return false
		}
		s.start = s.start.Add(time.Duration(d) * time.Millisecond)
		switch {
		case s.static:
			s.fading = scrollScene{prefix: s.prefix, text: s.text, x: s.x0, clipX: s.x0, on: true}
			s.fadeStart = s.start
			return true
		case s.phase == scrollGone:
			return true
		case s.phase == scrollWaiting:
			s.phase = scrollMoving
		default:
			s.phase = scrollGone
		}
	}
}

// scrollScene is where the page is drawn this tick: x is the text's left edge, clipX the left edge of the area
// it is visible in, dy its offset while the page rises into the row, and faded how many of the fadeSteps of
// brightness it has lost.
type scrollScene struct {
	prefix, text string
	x, clipX, dy int
	faded        int
	on           bool
}

// fadedSteps is how far a fade that began f milliseconds ago has got.
func fadedSteps(f int64) int {
	return int(f * fadeSteps / pageFade)
}

func (s *scroller) scene(now time.Time) scrollScene {
	e := now.Sub(s.selected).Milliseconds()
	if e < pageAppearDelay {
		if f := now.Sub(s.fadeStart).Milliseconds(); f >= 0 && f < pageFade {
			sc := s.fading
			sc.faded = fadedSteps(f)
			return sc
		}
		return scrollScene{}
	}
	sc := scrollScene{prefix: s.prefix, text: s.text, x: s.x0, clipX: s.x0, on: true}
	if s.slide > 0 && e < pageAppearDelay+infoSlideIn {
		sc.dy = int(int64(s.slide) * (pageAppearDelay + infoSlideIn - e) / infoSlideIn)
	}
	switch {
	case s.static:
	case s.phase == scrollMoving:
		sc.x = s.x0 + s.outerW - int(now.Sub(s.start).Milliseconds()*int64(s.speed)/1000)
	case s.phase == scrollGone:
		// Once the list has gone the prefix has nothing to label, so it fades out rather than waiting for
		// the next page.
		f := now.Sub(s.start).Milliseconds()
		sc.text = ""
		sc.faded = fadedSteps(f)
		sc.on = f < pageFade
	default:
		sc.text = ""
	}
	return sc
}
