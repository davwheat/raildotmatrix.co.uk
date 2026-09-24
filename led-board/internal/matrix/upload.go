package matrix

import (
	"bytes"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// uploadBuffer remembers the pixels in one native canvas. Each side of the double buffer has its own copy:
// comparing only with the last presented frame would leave stale pixels in the canvas from two swaps ago.
type uploadBuffer struct {
	pixels []byte
	valid  bool
}

func (b *uploadBuffer) upload(f *frame.Frame, rows func(y, height int)) {
	if !b.valid {
		rows(0, f.H)
		if len(b.pixels) != len(f.Pix) {
			b.pixels = make([]byte, len(f.Pix))
		}
	} else {
		stride := f.W * 3
		start := -1
		for y := range f.H {
			i := y * stride
			if !bytes.Equal(b.pixels[i:i+stride], f.Pix[i:i+stride]) {
				if start < 0 {
					start = y
				}
			} else if start >= 0 {
				rows(start, y-start)
				start = -1
			}
		}
		if start >= 0 {
			rows(start, f.H-start)
		}
	}
	copy(b.pixels, f.Pix)
	b.valid = true
}
