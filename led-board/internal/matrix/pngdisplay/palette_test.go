package pngdisplay

import (
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestPalettePreservesColoursAndFallsBack(t *testing.T) {
	for _, scale := range []int{1, 3, 6} {
		w, err := New(Options{Dir: t.TempDir(), Width: 31, Height: 17, Scale: scale})
		if err != nil {
			t.Fatal(err)
		}
		for _, colours := range []int{1, 2, 16, 17, 256, 257, 500, 3, 17, 1} {
			f := frame.New(31, 17)
			for i := range f.W * f.H {
				c := i % colours
				f.Set(i%f.W, i/f.W, frame.RGB{R: uint8(c), G: uint8(c >> 8), B: uint8(255 - c)})
			}
			if err := w.Swap(f); err != nil {
				t.Fatal(err)
			}
			paths, err := filepath.Glob(filepath.Join(w.opts.Dir, "*.png"))
			if err != nil {
				t.Fatal(err)
			}
			in, err := os.Open(paths[len(paths)-1])
			if err != nil {
				t.Fatal(err)
			}
			img, err := png.Decode(in)
			in.Close()
			if err != nil {
				t.Fatal(err)
			}
			for y := range img.Bounds().Dy() {
				for x := range img.Bounds().Dx() {
					want := f.At(x/scale, y/scale)
					r, g, b, a := img.At(x, y).RGBA()
					if r>>8 != uint32(want.R) || g>>8 != uint32(want.G) || b>>8 != uint32(want.B) || a != 65535 {
						t.Fatalf("%d colours at scale %d: changed pixel %d,%d", colours, scale, x, y)
					}
				}
			}
		}
	}
}
