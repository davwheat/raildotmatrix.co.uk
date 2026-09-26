package board

import (
	"math/bits"
	"sort"
	"unicode/utf8"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// TextRun caches the layout and visible monochrome tiles of one scrolling string.
// Drawing reuses glyph pixels across scroll positions, colours and clips.
// Faces must be immutable, as the embedded board fonts are. The zero value works.
type TextRun struct {
	face       *font.Face
	text       string
	points     []textPoint
	advance    int
	tiles      []uint64
	tileHeight int
	tileTags   [textTileCount]int
	tilesReady bool
}

type textPoint struct{ byteIndex, x int }

// Bound retained layout storage even for unusually large feed messages. Longer
// text still draws normally, without caching; this does not truncate the text.
const maxCachedTextBytes = 4096

// Draw has the same clipping and returned advance as DrawText. Position, colour
// and clip can change without rebuilding the layout.
func (r *TextRun) Draw(dst *frame.Frame, face *font.Face, x, y int, text string, colour frame.RGB, clip Clip) int {
	if len(text) > maxCachedTextBytes || face.Spacing < 0 {
		return DrawText(dst, face, x, y, text, colour, clip)
	}
	if r.face != face || r.text != text {
		r.face, r.text, r.advance = face, text, 0
		r.points = r.points[:0]
		if n := utf8.RuneCountInString(text); n > cap(r.points) {
			r.points = make([]textPoint, 0, n)
		}
		for byteIndex, ch := range text {
			r.points = append(r.points, textPoint{byteIndex, r.advance})
			r.advance += face.Advance(ch)
		}
		r.resetTiles()
	}
	clip = clip.Intersect(Clip{0, 0, dst.W, dst.H})
	if clip.Empty() || y >= clip.Y1 || y+face.Height <= clip.Y0 {
		// DrawText returns Width (without trailing spacing) for a hidden run.
		width := r.advance
		if width > 0 {
			width -= face.Spacing
		}
		return x + width
	}
	if len(r.points) == 0 {
		return x
	}
	end := x + r.advance
	if r.tileHeight > 0 && r.drawTiles(dst, x, y, colour, clip) {
		return end
	}
	// Start at the character crossing the left edge, or at the first one if
	// the run has not entered yet. Nonnegative spacing keeps positions sorted.
	i := max(0, sort.Search(len(r.points), func(i int) bool { return r.points[i].x > clip.X0-x })-1)
	point := r.points[i]
	x += point.x
	for _, ch := range text[point.byteIndex:] {
		if x >= clip.X1 {
			break
		}
		glyph := GlyphOf(face, ch)
		if x+glyph.Width > clip.X0 {
			DrawGlyph(dst, glyph, x, y, colour, clip)
		}
		x += glyph.Width + face.Spacing
	}
	return end
}

// Eight 64-column monochrome tiles cache only text near the viewport. Storage
// is at most 4 KiB, even for long messages or unusually tall custom fonts.
const textTileCount = 8
const maxTextTileWords = textTileCount * 64

func (r *TextRun) resetTiles() {
	r.tileHeight = 0
	r.tilesReady = false
	if r.advance <= 0 || r.face.Height <= 0 || r.face.Height > 64 {
		return
	}
	n := textTileCount * r.face.Height
	if cap(r.tiles) < n {
		r.tiles = make([]uint64, n)
	} else {
		r.tiles = r.tiles[:n]
	}
	for i := range r.tileTags {
		r.tileTags[i] = -1
	}
	r.tileHeight = r.face.Height
}

func (r *TextRun) cacheTile(tile int) bool {
	slot := tile & (textTileCount - 1)
	if r.tileTags[slot] == tile {
		return true
	}
	start, end := tile*64, (tile+1)*64
	bitmap := r.tiles[slot*r.tileHeight : (slot+1)*r.tileHeight]
	clear(bitmap)
	i := max(0, sort.Search(len(r.points), func(i int) bool { return r.points[i].x > start })-1)
	for ; i < len(r.points); i++ {
		point := r.points[i]
		if point.x >= end {
			break
		}
		ch, _ := utf8.DecodeRuneInString(r.text[point.byteIndex:])
		glyph := GlyphOf(r.face, ch)
		if glyph.Width < 0 || glyph.Width > 16 || len(glyph.Rows) > r.face.Height {
			r.tileHeight = 0
			return false
		}
		allowed := (uint32(1) << uint(glyph.Width)) - 1
		offset := point.x - start
		for row, lit := range glyph.Rows {
			if uint32(lit)&^allowed != 0 {
				r.tileHeight = 0
				return false
			}
			if offset >= 0 {
				bitmap[row] |= uint64(lit) << uint(offset)
			} else {
				bitmap[row] |= uint64(lit) >> uint(-offset)
			}
		}
	}
	r.tileTags[slot] = tile
	return true
}

func (r *TextRun) drawTiles(dst *frame.Frame, x, y int, colour frame.RGB, clip Clip) bool {
	left, right := max(0, clip.X0-x), min(r.advance, clip.X1-x)
	top, bottom := max(0, clip.Y0-y), min(r.face.Height, clip.Y1-y)
	if left >= right || top >= bottom {
		return true
	}
	first, last := left/64, (right-1)/64
	if last-first >= textTileCount {
		return false
	}
	// A string shown only once should pay no tile construction cost.
	if !r.tilesReady {
		r.tilesReady = true
		return false
	}
	for tile := first; tile <= last; tile++ {
		if !r.cacheTile(tile) {
			return false
		}
	}
	for row := top; row < bottom; row++ {
		for tile := first; tile <= last; tile++ {
			lit := r.tiles[(tile&(textTileCount-1))*r.tileHeight+row]
			if tile == first {
				lit &= ^uint64(0) << uint(left&63)
			}
			if tile == last && right&63 != 0 {
				lit &= (uint64(1) << uint(right&63)) - 1
			}
			base := ((y+row)*dst.W + x + tile*64) * 3
			for ; lit != 0; lit &= lit - 1 {
				index := base + bits.TrailingZeros64(lit)*3
				pixel := dst.Pix[index : index+3]
				pixel[0], pixel[1], pixel[2] = colour.R, colour.G, colour.B
			}
		}
	}
	return true
}
