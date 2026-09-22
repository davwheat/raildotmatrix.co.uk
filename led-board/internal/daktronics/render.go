package daktronics

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// rowScene is one train row as drawn this tick. dy shifts it vertically while it slides; clipX hides
// everything left of it during the clear-down wipe.
type rowScene struct {
	on                                bool
	ordinal, platform, std, dest, etd string
	dy, clipX                         int
}

// scene is a complete description of one frame. Two ticks that compose equal scenes draw the same picture,
// which is how Tick avoids redrawing a still board; it must stay comparable and free of slices.
type scene struct {
	mode    mode
	warning [3]string
	lit     bool

	first rowScene
	// entering is set while the first row slides up through the three train rows.
	entering bool
	line2    string
	spinnerX int
	spinnerB bool
	spinner  bool
	info     scrollScene
	infoRow  int
	third    rowScene

	clock clockScene
}

func (b *Board) compose(now time.Time) scene {
	g := &b.geo
	s := scene{mode: b.mode, warning: b.content.warning, clock: b.clock.scene(now, g.cell)}
	switch b.mode {
	case modeAlteration:
		s.lit = now.Sub(b.modeStart).Milliseconds()/alterationFlash%2 == 0
	case modeTrains:
		b.composeTrains(now, &s)
	}
	return s
}

func (b *Board) composeTrains(now time.Time, s *scene) {
	g := &b.geo
	e := now.Sub(b.phaseStart).Milliseconds()
	switch b.phase {
	case phaseClearDown:
		s.first = firstRowScene(&b.outgoing)
		travel := int64(g.w + clearDownOverrun)
		if e > clearDownDelay {
			s.first.clipX = int(travel * min(e-clearDownDelay, clearDownWipe) / clearDownWipe)
		}
		s.first.on = s.first.clipX < g.w
		if lag := e - clearDownDelay - clearDownSpinnerLag; lag >= 0 && lag < clearDownWipe {
			s.spinner = true
			s.spinnerX = int(travel * lag / clearDownWipe)
			s.spinnerB = e/spinnerFlip%2 == 1
		}
	case phaseSlideIn:
		s.first = firstRowScene(&b.content.rows[0])
		s.first.dy = int(int64(3*g.rowH) * (slideInDuration - e) / slideInDuration)
		s.entering = true
	case phaseSteady:
		b.composeSteady(now, s)
	}
}

func (b *Board) composeSteady(now time.Time, s *scene) {
	g := &b.geo
	first := &b.content.rows[0]
	s.first = firstRowScene(first)
	s.line2 = first.line2
	s.infoRow = 1
	if first.line2 != "" {
		s.infoRow = 2
	}
	if len(b.content.pages) > 0 {
		s.info = b.info.scene(now, font.Text.Height)
	}
	if first.line2 != "" || thirdRowCount(b.content) == 0 {
		return
	}
	r := &b.content.rows[1+b.swapIndex]
	s.third = rowScene{on: true, ordinal: r.ordinal, platform: r.platform, std: r.std, etd: r.etd}
	if len(r.pages) > 0 {
		s.third.dest = r.pages[int(now.Sub(b.steadyStart).Milliseconds()/destinationPage)%len(r.pages)]
	}
	if e := now.Sub(b.rowSlideStart).Milliseconds(); e < rowSlideDuration {
		s.third.dy = int(int64(g.rowH) * (rowSlideDuration - e) / rowSlideDuration)
	}
}

func firstRowScene(r *row) rowScene {
	return rowScene{on: true, ordinal: r.ordinal, platform: r.platform, std: r.std, dest: r.line1, etd: r.etd}
}

func (b *Board) render(f *frame.Frame, s *scene) {
	f.Clear()
	switch s.mode {
	case modeNoServices:
		b.drawCentred(f, 1, "CUSTOMER INFORMATION SYSTEM")
	case modeWarning:
		for i, line := range s.warning {
			b.drawCentred(f, i, line)
		}
	case modeAlteration:
		if s.lit {
			b.drawCentred(f, 1, "PLATFORM ALTERATION")
		}
	case modeTrains:
		b.renderTrains(f, s)
	}
	b.drawClock(f, &s.clock)
}

func (b *Board) renderTrains(f *frame.Frame, s *scene) {
	g := &b.geo
	if s.first.on {
		if s.entering {
			for i := range 3 {
				b.drawRow(f, &s.first, 0, g.band(i))
			}
		} else {
			b.drawRow(f, &s.first, 0, g.band(0))
		}
	}
	if s.spinner {
		board.DrawGlyph(f, spinnerGlyph(s.spinnerB), s.spinnerX, g.textY(0), b.cfg.Colour, g.band(0))
	}
	if s.line2 != "" {
		board.DrawText(f, font.Text, g.destX, g.textY(1), s.line2, b.cfg.Colour, g.band(1))
	}
	if s.info.on {
		b.drawInfo(f, &s.info, s.infoRow)
	}
	if s.third.on {
		b.drawRow(f, &s.third, 2, g.band(2))
	}
}

func (b *Board) drawRow(f *frame.Frame, r *rowScene, rowIndex int, c board.Clip) {
	g := &b.geo
	c.X0 = max(c.X0, r.clipX)
	y := g.textY(rowIndex) + r.dy
	board.DrawText(f, font.Text, g.ordinalX, y, r.ordinal, b.cfg.Colour, c)
	board.DrawText(f, font.Text, g.platX, y, r.platform, b.cfg.Colour, c.Intersect(board.Clip{X0: g.platX, X1: g.platX + g.platW, Y1: g.h}))
	board.DrawCells(f, font.Text, g.stdX, y, r.std, g.ch, b.cfg.Colour, c)
	board.DrawText(f, font.Text, g.destX, y, r.dest, b.cfg.Colour, c.Intersect(board.Clip{X0: g.destX, X1: g.destX + g.destW, Y1: g.h}))
	if isTime(r.etd) {
		board.DrawCells(f, font.Text, g.w-4*g.ch, y, r.etd, g.ch, b.cfg.Colour, c)
	} else {
		board.DrawText(f, font.Text, g.w-font.Text.Width(r.etd), y, r.etd, b.cfg.Colour, c)
	}
}

func isTime(s string) bool {
	if len(s) != 4 {
		return false
	}
	for i := range 4 {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func (b *Board) drawInfo(f *frame.Frame, sc *scrollScene, rowIndex int) {
	g := &b.geo
	c := g.band(rowIndex)
	y := g.textY(rowIndex) + sc.dy
	x := board.DrawText(f, font.Text, sc.x, y, sc.prefix, b.cfg.Colour, c)
	if sc.prefixOnly {
		return
	}
	if sc.prefix == "" {
		x = sc.x
	}
	board.DrawText(f, font.Text, x, y, sc.text, b.cfg.Colour, c)
}

func (b *Board) drawCentred(f *frame.Frame, rowIndex int, s string) {
	g := &b.geo
	board.DrawText(f, font.Text, (g.w-font.Text.Width(s))/2, g.textY(rowIndex), s, b.cfg.Colour, g.band(rowIndex))
}

func (b *Board) drawClock(f *frame.Frame, c *clockScene) {
	g := &b.geo
	y := g.rowTop(3) + max((g.rowH-font.Clock.Height)/2-1, 0)
	for i, d := range c {
		if d.right <= d.left {
			continue
		}
		x := g.clockX + i*g.cell
		glyph := board.GlyphOf(font.Clock, rune(d.ch))
		board.DrawGlyph(f, glyph, x+(g.cell-glyph.Width)/2, y, b.cfg.Colour, board.Clip{X0: x + int(d.left), X1: x + int(d.right), Y1: g.h})
	}
}

// The clear-down spinner alternates between '×' and '÷'. The web relies on the browser's fallback font for
// them, so when the dot font lacks them these stand in.
var (
	spinnerCross  = font.Glyph{Width: 5, Rows: []uint16{0b00000, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b00000}}
	spinnerObelus = font.Glyph{Width: 5, Rows: []uint16{0b00000, 0b00100, 0b00000, 0b11111, 0b00000, 0b00100, 0b00000}}
)

func spinnerGlyph(second bool) font.Glyph {
	r, local := '×', spinnerCross
	if second {
		r, local = '÷', spinnerObelus
	}
	if g, ok := font.Text.Glyphs[r]; ok {
		return g
	}
	return local
}
