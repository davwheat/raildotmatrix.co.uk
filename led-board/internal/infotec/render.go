package infotec

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// rowScene is one train row as drawn this tick: dx shifts it right while it slides out, dy moves it vertically
// while the lower rows swap, and etdLevel is the ETD's brightness out of fadeLevels while it flashes.
type rowScene struct {
	on                      bool
	ordinal, std, dest, etd string
	dx, dy                  int
	etdLevel                int
}

// scene is a complete description of one frame. Two ticks that compose equal scenes draw the same picture,
// which is how Tick avoids redrawing a still board; it must stay comparable and free of slices.
type scene struct {
	mode   mode
	notice model.Notice
	// level is the brightness of everything but the clock, out of fadeLevels.
	level int

	first rowScene
	info  scrollScene
	// lower holds the 2nd and 3rd rows, which share one band and slide past each other when they swap.
	lower [2]rowScene

	clock [8]byte
}

func (b *Board) compose(now time.Time) scene {
	s := scene{mode: b.mode, notice: b.view.Notice, level: b.level(now), clock: clockDigits(now, b.cfg.Zone)}
	if b.mode == modeTrains {
		b.composeTrains(now, &s)
	}
	return s
}

func (b *Board) level(now time.Time) int {
	// The slide-out itself is at full brightness; only what follows it fades in.
	if b.fadeInStart.IsZero() || b.mode == modeTrains && b.phase == phaseSlideOut {
		return fadeLevels
	}
	e := min(max(now.Sub(b.fadeInStart).Milliseconds(), 0), arriveFade)
	return int(e * fadeLevels / arriveFade)
}

func (b *Board) composeTrains(now time.Time, s *scene) {
	g := &b.geo
	if b.phase == phaseSlideOut {
		e := now.Sub(b.phaseStart).Milliseconds()
		s.first = b.rowScene(&b.outgoing, now)
		if e > slideOutDelay {
			s.first.dx = int(int64(g.w) * min(e-slideOutDelay, slideOutTravel) / slideOutTravel)
		}
		s.first.on = s.first.dx < g.w
		return
	}
	s.first = b.rowScene(&b.content.rows[0], now)
	if len(b.content.pages) > 0 {
		s.info = b.info.scene(now)
	}
	switch {
	case len(b.content.rows) < 2:
	case !hasSwap(b.content):
		s.lower[0] = b.rowScene(&b.content.rows[1], now)
	default:
		e := now.Sub(b.swapStart).Milliseconds()
		for i := range s.lower {
			r := b.rowScene(&b.content.rows[1+i], now)
			// SwapBetween.tsx places each child at (index - shown) x 105% and lets the transform transition.
			from, to := (i-b.swapFrom)*g.swapTravel, (i-b.swapIndex)*g.swapTravel
			r.dy = to
			if e < swapSlide {
				r.dy = from + int(int64(to-from)*e/swapSlide)
			}
			r.on = r.dy > -font.PISTall.Height && r.dy < font.PISTall.Height
			s.lower[i] = r
		}
	}
}

func (b *Board) rowScene(r *row, now time.Time) rowScene {
	e := now.Sub(b.steadyStart).Milliseconds()
	sc := rowScene{on: true, ordinal: r.ordinal, std: r.std, etd: r.etd, etdLevel: fadeLevels}
	if len(r.pages) > 0 {
		sc.dest = r.pages[int(e/destinationPage)%len(r.pages)]
	}
	if r.cancelled {
		sc.etdLevel = flashLevel(e)
	}
	return sc
}

// flashLevel is a cancelled ETD's brightness e milliseconds into its flash, out of fadeLevels.
func flashLevel(e int64) int {
	switch p := e % flashPeriod; {
	case p < flashOut:
		return int((flashOut - p) * fadeLevels / flashOut)
	case p < flashIn:
		return int((p - flashOut) * fadeLevels / (flashIn - flashOut))
	default:
		return fadeLevels
	}
}

func (b *Board) render(f *frame.Frame, s *scene) {
	f.Clear()
	colour := board.Scale(b.cfg.Colour, s.level, fadeLevels)
	switch s.mode {
	case modeNoServices:
		b.drawLines(f, nreLines, colour)
	case modeWarning:
		b.drawLines(f, warningLines(s.notice), colour)
	case modeTrains:
		b.renderTrains(f, s, colour)
	}
	b.drawClock(f, s.clock)
}

func (b *Board) renderTrains(f *frame.Frame, s *scene, colour frame.RGB) {
	g := &b.geo
	if s.first.on {
		b.drawRow(f, &s.first, g.firstY, g.full, colour)
	}
	if s.info.on {
		b.drawInfo(f, &s.info, colour)
	}
	// The separator stays lit through the slide-out, so fading it in with the new rows would blink it off.
	for x := range g.w {
		f.Set(x, g.sepY, b.dim)
	}
	for i := range s.lower {
		if s.lower[i].on {
			b.drawRow(f, &s.lower[i], g.secondY, g.secondBand(), colour)
		}
	}
}

func (b *Board) drawRow(f *frame.Frame, r *rowScene, y int, c board.Clip, colour frame.RGB) {
	g := &b.geo
	text := font.PISTall
	x, y := r.dx, y+r.dy
	board.DrawText(f, text, x, y, r.ordinal, colour, c)
	b.drawTime(f, x+g.stdX, y, r.std, c, colour)
	dest := c.Intersect(board.Clip{X0: x + g.destX, X1: x + g.destX + g.destW, Y1: g.h})
	board.DrawText(f, text, x+g.destX, y, r.dest, colour, dest)
	etd := board.Scale(colour, r.etdLevel, fadeLevels)
	if isTime(r.etd) {
		board.DrawText(f, text, x+g.w-g.timeW-g.exptW, y, "Expt ", etd, c)
		b.drawTime(f, x+g.w-g.timeW, y, r.etd, c, etd)
	} else {
		board.DrawText(f, text, x+g.w-text.Width(r.etd), y, r.etd, etd, c)
	}
}

// drawTime draws HHmm as the web's .time spans: each digit centred in a 1ch cell, the colon in a 0.5ch one.
func (b *Board) drawTime(f *frame.Frame, x, y int, hhmm string, c board.Clip, colour frame.RGB) {
	if len(hhmm) != 4 {
		return
	}
	g := &b.geo
	x = board.DrawCells(f, font.PISTall, x, y, hhmm[:2], g.ch, colour, c)
	x = board.DrawCells(f, font.PISTall, x, y, ":", g.colonCell, colour, c)
	board.DrawCells(f, font.PISTall, x, y, hhmm[2:], g.ch, colour, c)
}

func (b *Board) drawInfo(f *frame.Frame, sc *scrollScene, base frame.RGB) {
	g := &b.geo
	c := g.infoBand()
	y := g.infoY + sc.dy
	colour := board.Scale(base, fadeSteps-sc.faded, fadeSteps)
	board.DrawText(f, font.PISTall, 0, y, sc.prefix, colour, c)
	board.DrawText(f, font.PISTall, sc.x, y, sc.text, colour, c.Intersect(board.Clip{X0: sc.clipX, X1: g.w, Y1: g.h}))
}

func (b *Board) drawLines(f *frame.Frame, lines [3]string, colour frame.RGB) {
	g := &b.geo
	for i, line := range lines {
		board.DrawText(f, font.PISTall, (g.w-font.PISTall.Width(line))/2, g.lineY[i], line, colour, g.full)
	}
}

// drawClock draws HH:MM:SS as Clock.tsx lays it out: each character centred in a 1ch cell, colons in 0.4ch.
func (b *Board) drawClock(f *frame.Frame, digits [8]byte) {
	g := &b.geo
	face := font.DotMatrixClock
	x := g.clockX
	for _, d := range digits {
		cell := g.clockCell
		if d == ':' {
			cell = g.colon
		}
		glyph := board.GlyphOf(face, rune(d))
		board.DrawGlyph(f, glyph, x+(cell-glyph.Width-face.Spacing+1)/2, g.clockY, b.cfg.Colour, g.full)
		x += cell
	}
}
