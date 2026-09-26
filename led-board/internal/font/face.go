// Package font draws the Data Display and Infotec dot fonts using embedded glyph bitmaps.
// The editable sources are the YAFF files in fonts/; see yaff.go.
package font

import (
	"math/bits"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Glyph is one character's dots. Rows holds one row per line of the face, top first; bit 0 is the leftmost dot.
type Glyph struct {
	Width int
	Rows  []uint16
}

// Draw paints only the lit dots inside the half-open clip rectangle and frame.
// Clip rows and mask columns once instead of checking coordinates at every dot.
func (g Glyph) Draw(dst *frame.Frame, x, y int, c frame.RGB, x0, y0, x1, y1 int) {
	left := max(0, max(x0, 0)-x)
	right := min(16, min(x1, dst.W)-x)
	top := max(0, max(y0, 0)-y)
	bottom := min(len(g.Rows), min(y1, dst.H)-y)
	if left >= right || top >= bottom {
		return
	}
	mask := uint16((uint32(1)<<right)-1) & (^uint16(0) << left)
	for row := top; row < bottom; row++ {
		base := ((y+row)*dst.W + x) * 3
		for lit := g.Rows[row] & mask; lit != 0; lit &= lit - 1 {
			i := base + bits.TrailingZeros16(lit)*3
			pixel := dst.Pix[i : i+3]
			pixel[0], pixel[1], pixel[2] = c.R, c.G, c.B
		}
	}
}

// Face is a fixed-height dot font. Advance between glyphs is the glyph width plus Spacing.
type Face struct {
	// Height is the number of dot rows every glyph spans, including descender rows.
	Height int
	// Baseline is the number of rows above the baseline, which is also the index of the first descender row.
	Baseline int
	Spacing  int
	Glyphs   map[rune]Glyph
	// Fallback is drawn for runes the face lacks.
	Fallback Glyph
}

func (f *Face) glyph(r rune) Glyph {
	if g, ok := f.Glyphs[r]; ok {
		return g
	}
	return f.Fallback
}

// Width returns the drawn width of s in dots.
func (f *Face) Width(s string) int {
	w := 0
	for _, r := range s {
		w += f.glyph(r).Width + f.Spacing
	}
	if w > 0 {
		w -= f.Spacing
	}
	return w
}

// Advance returns the width of one rune plus its trailing spacing.
func (f *Face) Advance(r rune) int {
	return f.glyph(r).Width + f.Spacing
}

// Draw renders s with its top-left dot at (x, y) and returns the x after the last glyph. Pixels outside the
// frame are dropped, so text can be scrolled through the edges.
func (f *Face) Draw(dst *frame.Frame, x, y int, s string, c frame.RGB) int {
	for _, r := range s {
		g := f.glyph(r)
		if x+g.Width > 0 && x < dst.W {
			g.Draw(dst, x, y, c, 0, 0, dst.W, dst.H)
		}
		x += g.Width + f.Spacing
	}
	return x
}

// DrawClipped is Draw restricted to the columns [clipX, clipX+clipW).
func (f *Face) DrawClipped(dst *frame.Frame, x, y int, s string, c frame.RGB, clipX, clipW int) int {
	for _, r := range s {
		g := f.glyph(r)
		if x+g.Width > clipX && x < clipX+clipW {
			g.Draw(dst, x, y, c, clipX, 0, clipX+clipW, dst.H)
		}
		x += g.Width + f.Spacing
	}
	return x
}
