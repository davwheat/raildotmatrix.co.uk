package font

import (
	"math/rand/v2"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Compare against the simple per-pixel definition, including off-screen glyphs,
// inverted/empty clips and all 16 bitmap columns (not just production fonts).
func TestGlyphDrawClipping(t *testing.T) {
	rng := rand.New(rand.NewPCG(17, 29))
	for n := range 5000 {
		w, h := rng.IntN(40), rng.IntN(25)
		got, want := frame.New(w, h), frame.New(w, h)
		g := Glyph{Width: rng.IntN(17), Rows: make([]uint16, rng.IntN(20))}
		for i := range g.Rows {
			g.Rows[i] = uint16(rng.Uint32())
		}
		x, y := rng.IntN(70)-25, rng.IntN(50)-25
		x0, x1 := rng.IntN(70)-25, rng.IntN(70)-25
		y0, y1 := rng.IntN(50)-25, rng.IntN(50)-25
		colour := frame.RGB{R: 13, G: 157, B: 241}
		g.Draw(got, x, y, colour, x0, y0, x1, y1)
		for row, bitmap := range g.Rows {
			for col := range 16 {
				px, py := x+col, y+row
				if bitmap&(1<<col) != 0 && px >= x0 && px < x1 && py >= y0 && py < y1 {
					want.Set(px, py, colour)
				}
			}
		}
		if !got.Equal(want) {
			t.Fatalf("case %d: glyph (%d,%d), clip (%d,%d)-(%d,%d), frame %dx%d", n, x, y, x0, y0, x1, y1, w, h)
		}
	}
}
