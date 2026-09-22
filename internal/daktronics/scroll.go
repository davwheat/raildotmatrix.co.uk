package daktronics

import (
	"time"

	"github.com/davwheat/led-departure-board/internal/font"
)

// DefaultScrollSpeed is the scroll speed in dots per second: the web's 550 px/s at 11.43 px per dot.
const DefaultScrollSpeed = 48

// Timings of SlideyScrollText.tsx, in milliseconds.
const (
	scrollPauseAtEnds   = 1000
	scrollSlideDown     = 400
	scrollSlideDownRest = 1500
)

type scrollPhase uint8

const (
	// scrollHidden is the pause before anything appears: the prefix waits above the row, the text off its
	// right edge.
	scrollHidden scrollPhase = iota
	// scrollDropping is the prefix sliding down into view at the right edge of the row.
	scrollDropping
	// scrollResting holds the prefix in place before the line moves.
	scrollResting
	// scrollMoving is the whole line travelling left until it has left the row.
	scrollMoving
	// scrollGone is the pause after the line has gone, before the next page.
	scrollGone
)

// scroller is a port of SlideyScrollText: a prefix drops in at the right-hand edge, waits, and then the whole
// line scrolls off to the left. Without a prefix the line simply scrolls in from the right.
type scroller struct {
	prefix, text string
	prefixW      int
	lineW        int
	outerW       int
	phase        scrollPhase
	start        time.Time
	// speed is the scroll speed in dots per second.
	speed int
}

func (s *scroller) reset(p page, outerW int, now time.Time) {
	s.prefix, s.text = p.prefix, p.text
	s.prefixW = font.Text.Width(p.prefix)
	s.lineW = font.Text.Width(p.prefix) + font.Text.Width(p.text)
	if p.prefix != "" && p.text != "" {
		s.lineW += font.Text.Spacing
	}
	s.outerW = outerW
	s.phase = scrollHidden
	s.start = now
}

// startX is where the line's left edge sits while the prefix is shown at the right edge of the row.
func (s *scroller) startX() int { return s.outerW - s.prefixW }

func (s *scroller) duration() int64 {
	switch s.phase {
	case scrollHidden, scrollGone:
		return scrollPauseAtEnds
	case scrollDropping:
		return scrollSlideDown
	case scrollResting:
		return scrollSlideDownRest
	default:
		return int64(s.startX()+s.lineW) * 1000 / int64(s.speed)
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
		switch s.phase {
		case scrollHidden:
			if s.prefix == "" {
				s.phase = scrollMoving
			} else {
				s.phase = scrollDropping
			}
		case scrollDropping:
			s.phase = scrollResting
		case scrollResting:
			s.phase = scrollMoving
		case scrollMoving:
			s.phase = scrollGone
		case scrollGone:
			return true
		}
	}
}

// scrollScene is where the line is drawn this tick: x is its left edge and dy its vertical offset while the
// prefix drops in, during which only the prefix is drawn.
type scrollScene struct {
	prefix, text string
	x, dy        int
	prefixOnly   bool
	on           bool
}

func (s *scroller) scene(now time.Time, dropHeight int) scrollScene {
	e := now.Sub(s.start).Milliseconds()
	sc := scrollScene{prefix: s.prefix, text: s.text, on: true}
	switch s.phase {
	case scrollHidden, scrollGone:
		return scrollScene{}
	case scrollDropping:
		sc.x = s.startX()
		sc.dy = -int(int64(dropHeight) * (scrollSlideDown - e) / scrollSlideDown)
		sc.prefixOnly = true
	case scrollResting:
		sc.x = s.startX()
		sc.prefixOnly = true
	case scrollMoving:
		sc.x = s.startX() - int(e*int64(s.speed)/1000)
	}
	return sc
}
