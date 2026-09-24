package pngdisplay

import (
	"fmt"
	"image"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func benchmarkFrame() *frame.Frame {
	f := frame.New(256, 64)
	for y := range f.H {
		for x := range f.W {
			if (x+3*y)%5 == 0 {
				f.Set(x, y, frame.RGB{R: 230, G: 150})
			}
		}
	}
	return f
}

func BenchmarkScaleInto(b *testing.B) {
	f := benchmarkFrame()
	for _, scale := range []int{1, 3, 6} {
		b.Run(fmt.Sprintf("scale-%d", scale), func(b *testing.B) {
			img := image.NewRGBA(image.Rect(0, 0, f.W*scale, f.H*scale))
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				scaleInto(img, f, scale)
			}
		})
	}
}

func BenchmarkDots(b *testing.B) {
	f := benchmarkFrame()
	b.ReportAllocs()
	b.ResetTimer()
	for b.Loop() {
		Dots(f, 6)
	}
}

func BenchmarkWriter(b *testing.B) {
	f := benchmarkFrame()
	w, err := New(Options{Dir: b.TempDir(), Width: f.W, Height: f.H, Scale: 3})
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for b.Loop() {
		if err := w.Swap(f); err != nil {
			b.Fatal(err)
		}
	}
}
