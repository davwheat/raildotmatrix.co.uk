package pngdisplay

import (
	"bytes"

	"image/png"

	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestIndexedDotsMatchRGBA(t *testing.T) {
	for _, scale := range []int{1, 2, 3, 4, 5, 6, 9} {
		for _, colours := range []int{1, 2, 16, 255, 256, 257, 500} {
			f := frame.New(31, 17)
			for i := range f.W * f.H {
				c := i%colours + 1 // Source has no black; its background must be added.
				f.Set(i%f.W, i/f.W, frame.RGB{R: uint8(c), G: uint8(c >> 8), B: uint8(255 - c)})
			}
			for _, black := range []bool{false, true} {
				if black {
					f.Set(3, 4, frame.Black)
				}
				want := dotsRGBA(f, scale)
				var out bytes.Buffer
				if err := encoder.Encode(&out, Dots(f, scale)); err != nil {
					t.Fatal(err)
				}
				got, err := png.Decode(&out)
				if err != nil {
					t.Fatal(err)
				}
				if got.Bounds() != want.Bounds() {
					t.Fatal("dot dimensions changed")
				}
				for y := range want.Bounds().Dy() {
					for x := range want.Bounds().Dx() {
						r, g, b, a := got.At(x, y).RGBA()
						wr, wg, wb, wa := want.At(x, y).RGBA()
						if r != wr || g != wg || b != wb || a != wa {
							t.Fatalf("scale=%d colours=%d black=%t pixel=%d,%d", scale, colours, black, x, y)
						}
					}
				}
			}
		}
	}
}
