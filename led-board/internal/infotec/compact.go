package infotec

import (
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func (g *geometry) lowerFace() *font.Face {
	if g.compact {
		return font.InfotecSmall
	}
	return font.PISTall
}

// compactRow is where the compact lower row puts each column, which depends on the width of its expected time.
type compactRow struct {
	ch, colon, timeW          int
	prefixW, stdX             int
	destX, destW, etdX, timeX int
	// underBox centres the prefix beneath the first train's platform box.
	underBox bool
}

func (b *Board) compactLayout(etd string) compactRow {
	g, text := &b.geo, font.InfotecSmall
	l := compactRow{ch: text.Advance('0'), colon: 2}
	l.timeW = 4*l.ch + l.colon
	l.prefixW = text.Width("3rd")
	if b.cfg.RowPrefix == board.PrefixPlatforms {
		l.prefixW = board.PlatformWidth(text)
	}
	l.stdX = l.prefixW + 3
	if g.boxW > 0 && (b.cfg.AlignPlatformRows == nil || *b.cfg.AlignPlatformRows) {
		l.prefixW, l.stdX, l.underBox = g.boxW, g.stdX, true
	}
	l.destX = l.stdX + l.timeW + 3
	right := g.secondBand().X1
	l.etdX = right - text.Width(etd)
	if isTime(etd) {
		// Align the last lit digit edge, excluding its cell's trailing blank dots.
		last := board.GlyphOf(text, rune(etd[3]))
		trailing := l.ch - (l.ch-last.Width)/2 - last.Width
		l.timeX = right - l.timeW + trailing
		l.etdX = l.timeX - text.Width("Expt ") - text.Spacing
	}
	l.destW = max(l.destX, l.etdX-3) - l.destX
	return l
}

func (b *Board) drawCompactRow(f *frame.Frame, r *rowScene, colour frame.RGB) {
	g, text := &b.geo, font.InfotecSmall
	c := g.secondBand()
	y := g.secondY + r.dy
	l := b.compactLayout(r.etd)
	prefixX := 0
	if l.underBox {
		prefixX = (g.boxW - text.Width(r.prefix)) / 2
	}
	board.DrawText(f, text, prefixX, y, r.prefix, colour, c.Intersect(board.Clip{X1: l.prefixW, Y1: g.h}))
	drawTime := func(x int, value string, colour frame.RGB) {
		if len(value) != 4 {
			return
		}
		x = board.DrawCells(f, text, x, y, value[:2], l.ch, colour, c)
		x = board.DrawCells(f, text, x, y, ":", l.colon, colour, c)
		board.DrawCells(f, text, x, y, value[2:], l.ch, colour, c)
	}
	drawTime(l.stdX, r.std, colour)
	etd := board.Scale(colour, r.etdLevel, fadeLevels)
	if isTime(r.etd) {
		board.DrawText(f, text, l.etdX, y, "Expt ", etd, c)
		drawTime(l.timeX, r.etd, etd)
	} else {
		board.DrawText(f, text, l.etdX, y, r.etd, etd, c)
	}
	board.DrawText(f, text, l.destX, y, r.dest, colour, c.Intersect(board.Clip{X0: l.destX, X1: l.destX + l.destW, Y1: g.h}))
}
