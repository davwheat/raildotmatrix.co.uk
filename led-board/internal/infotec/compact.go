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

func (b *Board) drawCompactRow(f *frame.Frame, r *rowScene, colour frame.RGB) {
	g, text := &b.geo, font.InfotecSmall
	c := g.secondBand()
	y := g.secondY + r.dy
	ch, colon := text.Advance('0'), 2
	timeW := 4*ch + colon
	prefixW := text.Width("3rd")
	if b.cfg.RowPrefix == board.PrefixPlatforms {
		prefixW = board.PlatformWidth(text)
	}
	prefixX, stdX := 0, prefixW+3
	if g.boxW > 0 && (b.cfg.AlignPlatformRows == nil || *b.cfg.AlignPlatformRows) {
		prefixW = g.boxW
		prefixX = (g.boxW - text.Width(r.prefix)) / 2
		stdX = g.stdX
	}
	destX := stdX + timeW + 3
	board.DrawText(f, text, prefixX, y, r.prefix, colour, c.Intersect(board.Clip{X1: prefixW, Y1: g.h}))
	drawTime := func(x int, value string, colour frame.RGB) {
		if len(value) != 4 {
			return
		}
		x = board.DrawCells(f, text, x, y, value[:2], ch, colour, c)
		x = board.DrawCells(f, text, x, y, ":", colon, colour, c)
		board.DrawCells(f, text, x, y, value[2:], ch, colour, c)
	}
	drawTime(stdX, r.std, colour)
	etd := board.Scale(colour, r.etdLevel, fadeLevels)
	etdX := c.X1 - text.Width(r.etd)
	if isTime(r.etd) {
		// Align the last lit digit edge, excluding its cell's trailing blank dots.
		last := board.GlyphOf(text, rune(r.etd[3]))
		trailing := ch - (ch-last.Width)/2 - last.Width
		timeX := c.X1 - timeW + trailing
		etdX = timeX - text.Width("Expt ") - text.Spacing
		board.DrawText(f, text, etdX, y, "Expt ", etd, c)
		drawTime(timeX, r.etd, etd)
	} else {
		board.DrawText(f, text, etdX, y, r.etd, etd, c)
	}
	board.DrawText(f, text, destX, y, r.dest, colour, c.Intersect(board.Clip{X0: destX, X1: max(destX, etdX-3), Y1: g.h}))
}
