package daktronics

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
)

func (b *Board) nextStillTick(now, next time.Time, pixels bool) time.Time {
	if b.phase != phaseSteady || now.Before(b.steadyStart) {
		return time.Time{}
	}
	consider := func(at time.Time) {
		if at.Before(next) {
			next = at
		}
	}
	if count := thirdRowCount(b.content); count > 0 {
		if now.Sub(b.rowSlideStart) < rowSlideDuration*time.Millisecond {
			return time.Time{}
		}
		period := destinationPage * time.Millisecond
		consider(b.steadyStart.Add((now.Sub(b.steadyStart)/period + 1) * period))
		if count > 1 {
			consider(b.swapStart.Add(swapInterval * time.Millisecond))
		}
	}
	if len(b.content.pages) > 0 {
		if b.info.phase == scrollDropping || b.info.phase == scrollMoving && !pixels {
			return time.Time{}
		}
		if b.info.phase == scrollMoving {
			consider(board.NextScrollPixel(now, b.info.start, b.info.speed))
		}
		consider(b.info.start.Add(time.Duration(b.info.duration()) * time.Millisecond))
	}
	return next
}
