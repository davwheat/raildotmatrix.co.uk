package infotec

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
)

// Native ticks only wait while animation is stationary. Frontends already
// paced by RAF may also wait between scrolling pixels. Fades and slides retain
// display-refresh pacing; their starts are deadlines.
func (b *Board) nextStillTick(now, next time.Time, pixels bool) time.Time {
	if b.phase != phaseSteady || now.Before(b.steadyStart) {
		return time.Time{}
	}
	for _, row := range b.content.rows {
		if row.cancelled {
			return time.Time{}
		}
	}
	consider := func(at time.Time) {
		if at.Before(next) {
			next = at
		}
	}
	cycle := func(start time.Time, milliseconds int64) {
		period := time.Duration(milliseconds) * time.Millisecond
		consider(start.Add((now.Sub(start)/period + 1) * period))
	}
	cycle(b.steadyStart, destinationPage)
	cycle(b.steadyStart, 5000) // Formation pages share the five-second slots.
	if hasSwap(b.content) {
		if b.swapFrom != b.swapIndex && now.Sub(b.swapStart) < swapSlide*time.Millisecond {
			return time.Time{}
		}
		consider(b.swapStart.Add(swapInterval * time.Millisecond))
	}
	if len(b.content.pages) == 0 {
		return next
	}
	s := &b.info
	if s.phase == scrollMoving {
		if !pixels {
			return time.Time{}
		}
		consider(board.NextScrollPixel(now, s.start, s.speed))
	}
	if elapsed := now.Sub(s.fadeStart); elapsed >= 0 && elapsed < pageFade*time.Millisecond {
		return time.Time{}
	}
	if elapsed := now.Sub(s.selected); elapsed < pageAppearDelay*time.Millisecond {
		consider(s.selected.Add(pageAppearDelay * time.Millisecond))
	} else if s.slide > 0 && elapsed < (pageAppearDelay+infoSlideIn)*time.Millisecond {
		return time.Time{}
	}
	if s.phase == scrollGone && now.Sub(s.start) < pageFade*time.Millisecond {
		return time.Time{}
	}
	consider(s.start.Add(time.Duration(s.duration()) * time.Millisecond))
	return next
}
