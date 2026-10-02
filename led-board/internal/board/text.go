package board

import (
	"slices"
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
	g.Draw(dst, x, y, colour, c.X0, c.Y0, c.X1, c.Y1)
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

// PortionLabels names the part of a dividing train that each calling point page is for: the train's own, and
// then each portion that divides off, given the end of the train that each leaves from ("front", "middle",
// "rear", or "" when the feed doesn't say). The train's own part is the front unless a portion is known to be
// there. A portion at an unknown end is taken to be behind the ones before it, as the real boards assume: the
// last one is the rear and the others the middle.
func PortionLabels(positions []string) (own string, portions []string) {
	front, rear := slices.Contains(positions, "front"), slices.Contains(positions, "rear")
	own = "Front"
	switch {
	case front && rear:
		own = "Middle"
	case front:
		own = "Rear"
	}
	portions = make([]string, len(positions))
	for i, position := range positions {
		switch {
		case position == "front":
			portions[i] = "Front"
		case position == "rear":
			portions[i] = "Rear"
		case position == "middle" || i < len(positions)-1 || rear || own == "Rear":
			portions[i] = "Middle"
		default:
			portions[i] = "Rear"
		}
	}
	return own, portions
}

// PortionRank orders the pages of a dividing train from the front of the train to the rear.
func PortionRank(label string) int {
	switch label {
	case "Front":
		return 0
	case "Middle":
		return 1
	}
	return 2
}
