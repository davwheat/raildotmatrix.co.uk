// Package font draws the Data Display and Infotec dot fonts. Glyph bitmaps are generated from the fonts in
// raildotmatrix.co.uk by cmd/fontgen; see generate.go.
package font

import "github.com/davwheat/pi-departure-board/internal/frame"

// Glyph is one character's dots. Rows holds one row per line of the face, top first; bit 0 is the leftmost dot.
type Glyph struct {
	Width int
	Rows  []uint16
}

// Face is a fixed-height dot font. Advance between glyphs is the glyph width plus Spacing.
type Face struct {
	// Height is the number of dot rows every glyph spans, including descender rows.
	Height int
	// Baseline is the row index of the baseline within Height.
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
			for row, bits := range g.Rows {
				for col := 0; bits != 0; col, bits = col+1, bits>>1 {
					if bits&1 != 0 {
						dst.Set(x+col, y+row, c)
					}
				}
			}
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
			for row, bits := range g.Rows {
				for col := 0; bits != 0; col, bits = col+1, bits>>1 {
					px := x + col
					if bits&1 != 0 && px >= clipX && px < clipX+clipW {
						dst.Set(px, y+row, c)
					}
				}
			}
		}
		x += g.Width + f.Spacing
	}
	return x
}
