package infotec

import (
	"fmt"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Empty preserves the layout's default: small beside a service, normal below it.
func ValidateClockStyle(style string) error {
	switch style {
	case "", "normal", "small-seconds", "small":
		return nil
	}
	return fmt.Errorf("clock style must be normal, small-seconds or small")
}
func (g *geometry) clockFace(seconds bool) *font.Face {
	if g.clockStyle == "small" || (seconds && g.clockStyle == "small-seconds") {
		return font.InfotecSmallClock
	}
	return font.InfotecClock
}
func (g *geometry) clockWidth() int {
	face := g.clockFace(false)
	if g.clockStyle == "small-seconds" {
		return 4*face.Advance('0') + face.Advance(':') + 2 + 2*font.InfotecSmallClock.Advance('0')
	}
	return 6*face.Advance('0') + 2*face.Advance(':')
}
func (b *Board) drawClock(f *frame.Frame, digits [8]byte) {
	g := &b.geo
	x := g.clockX
	for i, d := range digits {
		if i == 5 && g.clockStyle == "small-seconds" {
			x += 2
			continue
		}
		face := g.clockFace(i > 5)
		cell := face.Advance('0')
		if d == ':' {
			cell = face.Advance(':')
		}
		glyph := board.GlyphOf(face, rune(d))
		y := g.clockY + g.clockFace(false).Height - face.Height
		board.DrawGlyph(f, glyph, x+(cell-glyph.Width)/2, y, b.cfg.Colour, g.full)
		x += cell
	}
}
