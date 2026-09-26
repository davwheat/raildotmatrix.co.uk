package board

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestTextTilesGeometryAndBounds(t *testing.T) {
	rng := rand.New(rand.NewPCG(192, 473))
	got, want := frame.New(139, 41), frame.New(139, 41)
	var run TextRun
	for caseIndex := range 1000 {
		face := &font.Face{Height: 1 + rng.IntN(35), Spacing: rng.IntN(8), Glyphs: map[rune]font.Glyph{}}
		for _, ch := range "ABC" {
			width := rng.IntN(17)
			glyph := font.Glyph{Width: width, Rows: make([]uint16, face.Height+rng.IntN(2))}
			for row := range glyph.Rows {
				glyph.Rows[row] = uint16(rng.Uint32())
				if caseIndex%2 == 0 {
					glyph.Rows[row] &= uint16(uint32(1)<<uint(width) - 1)
				}
			}
			face.Glyphs[ch] = glyph
		}
		switch caseIndex % 13 {
		case 0:
			face.Spacing = -1
		case 1:
			face.Spacing = 70000 // Bitmap budget must fall back without truncation.
		case 2:
			face.Spacing = 0
		}
		text := strings.Repeat("ABC ", 1+rng.IntN(20))
		for sample := range 8 {
			x, y := rng.IntN(250)-170, rng.IntN(75)-40
			clip := Clip{rng.IntN(45) - 10, rng.IntN(20) - 5, 70 + rng.IntN(100), 20 + rng.IntN(30)}
			colour := frame.RGB{R: uint8(rng.Uint32()), G: uint8(rng.Uint32()), B: uint8(rng.Uint32())}
			actual := run.Draw(got, face, x, y, text, colour, clip)
			expected := DrawText(want, face, x, y, text, colour, clip)
			if actual != expected || !got.Equal(want) {
				t.Fatalf("case %d sample %d differs", caseIndex, sample)
			}
			if cap(run.tiles) > maxTextTileWords {
				t.Fatal("raster storage exceeded bound")
			}
		}
	}
}
