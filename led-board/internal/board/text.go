package board

import (
	"strings"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Clip is a half-open rectangle [X0, X1) x [Y0, Y1) that drawing is confined to.
type Clip struct{ X0, Y0, X1, Y1 int }

func (c Clip) Intersect(o Clip) Clip {
	return Clip{max(c.X0, o.X0), max(c.Y0, o.Y0), min(c.X1, o.X1), min(c.Y1, o.Y1)}
}

func (c Clip) Empty() bool { return c.X0 >= c.X1 || c.Y0 >= c.Y1 }

// GlyphOf mirrors the face's own lookup so a board can draw with a clip on both axes, which Face lacks.
func GlyphOf(f *font.Face, r rune) font.Glyph {
	if g, ok := f.Glyphs[r]; ok {
		return g
	}
	return f.Fallback
}

// DrawText renders s with its top-left dot at (x, y), dropping dots outside c, and returns the x after the last
// glyph.
func DrawText(dst *frame.Frame, f *font.Face, x, y int, s string, colour frame.RGB, c Clip) int {
	c = c.Intersect(Clip{0, 0, dst.W, dst.H})
	if c.Empty() || y >= c.Y1 || y+f.Height <= c.Y0 {
		return x + f.Width(s)
	}
	for _, r := range s {
		g := GlyphOf(f, r)
		if x < c.X1 && x+g.Width > c.X0 {
			DrawGlyph(dst, g, x, y, colour, c)
		}
		x += g.Width + f.Spacing
	}
	return x
}

// DrawGlyph renders g with its top-left dot at (x, y), dropping dots outside c.
func DrawGlyph(dst *frame.Frame, g font.Glyph, x, y int, colour frame.RGB, c Clip) {
	for row, bits := range g.Rows {
		py := y + row
		if py < c.Y0 || py >= c.Y1 {
			continue
		}
		for col := 0; bits != 0; col, bits = col+1, bits>>1 {
			px := x + col
			if bits&1 != 0 && px >= c.X0 && px < c.X1 {
				dst.Set(px, py, colour)
			}
		}
	}
}

// DrawCells renders each rune of s centred in a cell of the given width, as the web boards do for digits, and
// returns the x after the last cell.
func DrawCells(dst *frame.Frame, f *font.Face, x, y int, s string, cell int, colour frame.RGB, c Clip) int {
	for _, r := range s {
		g := GlyphOf(f, r)
		DrawGlyph(dst, g, x+(cell-g.Width)/2, y, colour, c)
		x += cell
	}
	return x
}

// CombineNames joins location names into a sentence: "A", "A and B", or "A, B and C".
func CombineNames(locations []model.Location) string {
	names := make([]string, len(locations))
	for i, l := range locations {
		names[i] = l.Name
	}
	if len(names) < 2 {
		return strings.Join(names, "")
	}
	return strings.Join(names[:len(names)-1], ", ") + " and " + names[len(names)-1]
}
