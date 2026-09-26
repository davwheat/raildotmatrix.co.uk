package font

import (
	"strings"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestInfotecTwoMatchesReference(t *testing.T) {
	// User-supplied bitmap, written left to right (Glyph rows store bit 0 on
	// the left). Check rendered pixels to catch mirroring as well as shape.
	rows := strings.Split(`011111100
110000110
000000011
000000011
000000011
000000110
000001100
000011000
000110000
001100000
011000000
110000000
111111111`, "\n")
	f := frame.New(9, 13)
	white := frame.RGB{R: 255, G: 255, B: 255}
	InfotecLarge.Draw(f, 0, 0, "2", white)
	for y, row := range rows {
		for x, pixel := range row {
			if lit := f.At(x, y) == white; lit != (pixel == '1') {
				t.Errorf("pixel (%d,%d) does not match reference %c", x, y, pixel)
			}
		}
	}
}
