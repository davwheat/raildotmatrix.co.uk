package matrix

import (
	"bytes"
	"encoding/binary"
	"math/bits"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// uploadBuffer remembers the pixels in one native canvas. Each side of the double buffer has its own copy:
// comparing only with the last presented frame would leave stale pixels in the canvas from two swaps ago.
type uploadBuffer struct {
	pixels []byte
	valid  bool
}

func (b *uploadBuffer) upload(f *frame.Frame, rect func(x, y, width, height int)) {
	if !b.valid {
		rect(0, 0, f.W, f.H)
		if len(b.pixels) != len(f.Pix) {
			b.pixels = make([]byte, len(f.Pix))
		}
		copy(b.pixels, f.Pix)
	} else {
		stride := f.W * 3
		start := -1
		left, right := f.W, 0
		for y := range f.H {
			i := y * stride
			old, next := b.pixels[i:i+stride], f.Pix[i:i+stride]
			if !bytes.Equal(old, next) {
				if start < 0 {
					start = y
				}
				// Only extend the bounds already covered by this group of rows.
				// Byte offsets are rounded outwards to whole RGB pixels.
				if left > 0 {
					left = firstDifference(old[:left*3], next[:left*3]) / 3
				}
				if right < f.W {
					right = (stride - matchingSuffix(old[right*3:], next[right*3:]) + 2) / 3
				}
			} else if start >= 0 {
				b.send(f, rect, left, start, right-left, y-start)
				start = -1
				left, right = f.W, 0
			}
		}
		if start >= 0 {
			b.send(f, rect, left, start, right-left, f.H-start)
		}
	}
	b.valid = true
}

// Only the uploaded region changed. Keep its cached RGB bytes in sync without
// copying the rest of the frame again; full-width runs remain one bulk copy.
func (b *uploadBuffer) send(f *frame.Frame, rect func(x, y, width, height int), x, y, width, height int) {
	rect(x, y, width, height)
	stride := f.W * 3
	start := y*stride + x*3
	if width == f.W {
		end := start + height*stride
		copy(b.pixels[start:end], f.Pix[start:end])
		return
	}
	for range height {
		end := start + width*3
		copy(b.pixels[start:end], f.Pix[start:end])
		start += stride
	}
}

// Compare eight bytes at a time without alignment requirements or unsafe reads.
// The short byte loops handle RGB rows whose lengths are not multiples of eight.
func firstDifference(a, b []byte) int {
	i := 0
	for ; i+8 <= len(a); i += 8 {
		diff := binary.LittleEndian.Uint64(a[i:]) ^ binary.LittleEndian.Uint64(b[i:])
		if diff != 0 {
			return i + bits.TrailingZeros64(diff)/8
		}
	}
	for ; i < len(a) && a[i] == b[i]; i++ {
	}
	return i
}

func matchingSuffix(a, b []byte) int {
	i := len(a)
	for ; i >= 8; i -= 8 {
		diff := binary.LittleEndian.Uint64(a[i-8:]) ^ binary.LittleEndian.Uint64(b[i-8:])
		if diff != 0 {
			return len(a) - i + bits.LeadingZeros64(diff)/8
		}
	}
	for ; i > 0 && a[i-1] == b[i-1]; i-- {
	}
	return len(a) - i
}
