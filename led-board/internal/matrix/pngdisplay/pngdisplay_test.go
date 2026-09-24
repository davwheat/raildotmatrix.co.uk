package pngdisplay

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestScaleIntoReusesRowsAndHonoursStride(t *testing.T) {
	f := frame.New(3, 2)
	for y := range f.H {
		for x := range f.W {
			f.Set(x, y, frame.RGB{R: uint8(20 + x*40), G: uint8(30 + y*60), B: 70})
		}
	}
	for _, scale := range []int{1, 2, 3, 6} {
		t.Run(fmt.Sprint(scale), func(t *testing.T) {
			backing := image.NewRGBA(image.Rect(0, 0, f.W*scale+4, f.H*scale+4))
			bounds := image.Rect(2, 2, 2+f.W*scale, 2+f.H*scale)
			img := backing.SubImage(bounds).(*image.RGBA)
			scaleInto(img, f, scale)
			for y := range backing.Rect.Dy() {
				for x := range backing.Rect.Dx() {
					want := color.RGBA{}
					if image.Pt(x, y).In(bounds) {
						c := f.At((x-bounds.Min.X)/scale, (y-bounds.Min.Y)/scale)
						want = color.RGBA{c.R, c.G, c.B, 255}
					}
					if got := backing.RGBAAt(x, y); got != want {
						t.Fatalf("pixel %d,%d = %v, want %v", x, y, got, want)
					}
				}
			}
		})
	}
}

func TestConcurrentSnapshotsWithDifferentSizes(t *testing.T) {
	for _, scale := range []int{1, 3, 6} {
		t.Run(fmt.Sprint(scale), func(t *testing.T) {
			t.Parallel()
			f := frame.New(3, 2)
			name := filepath.Join(t.TempDir(), "snapshot.png")
			for _, c := range []frame.RGB{{R: 230, G: 150}, {}, {R: 239, G: 239, B: 239}} {
				f.FillRect(0, 0, f.W, f.H, c)
				if err := Encode(name, f, scale); err != nil {
					t.Fatal(err)
				}
				in, err := os.Open(name)
				if err != nil {
					t.Fatal(err)
				}
				img, err := png.Decode(in)
				in.Close()
				if err != nil {
					t.Fatal(err)
				}
				if img.Bounds() != image.Rect(0, 0, f.W*scale, f.H*scale) {
					t.Fatalf("unexpected bounds: %v", img.Bounds())
				}
				for y := range img.Bounds().Dy() {
					for x := range img.Bounds().Dx() {
						r, g, b, a := img.At(x, y).RGBA()
						if r>>8 != uint32(c.R) || g>>8 != uint32(c.G) || b>>8 != uint32(c.B) || a != 65535 {
							t.Fatalf("pixel %d,%d does not match %v", x, y, c)
						}
					}
				}
			}
		})
	}
}

func TestWriterScalesAndNumbers(t *testing.T) {
	dir := t.TempDir()
	w, err := New(Options{Dir: dir, Scale: 3, Width: 4, Height: 2})
	if err != nil {
		t.Fatal(err)
	}
	f := frame.New(4, 2)
	f.Set(3, 1, frame.RGB{R: 10, G: 20, B: 30})
	for range 2 {
		if err := w.Swap(f); err != nil {
			t.Fatal(err)
		}
	}

	in, err := os.Open(filepath.Join(dir, "frame-000002.png"))
	if err != nil {
		t.Fatal(err)
	}
	defer in.Close()
	img, err := png.Decode(in)
	if err != nil {
		t.Fatal(err)
	}
	if b := img.Bounds(); b.Dx() != 12 || b.Dy() != 6 {
		t.Fatalf("image is %dx%d, want 12x6", b.Dx(), b.Dy())
	}
	r, g, b, _ := img.At(11, 5).RGBA()
	if r>>8 != 10 || g>>8 != 20 || b>>8 != 30 {
		t.Fatalf("pixel = %d,%d,%d, want 10,20,30", r>>8, g>>8, b>>8)
	}
}

func TestSinkCopiesFrame(t *testing.T) {
	s := NewSink(2, 1)
	f := frame.New(2, 1)
	f.Set(1, 0, frame.RGB{R: 255})
	if err := s.Swap(f); err != nil {
		t.Fatal(err)
	}
	f.Clear()
	if got := s.Last().At(1, 0); got != (frame.RGB{R: 255}) {
		t.Fatalf("Last().At(1,0) = %v, want red", got)
	}
	if s.Swaps() != 1 {
		t.Fatalf("Swaps() = %d, want 1", s.Swaps())
	}
}

func TestSizeMismatch(t *testing.T) {
	s := NewSink(2, 2)
	if err := s.Swap(frame.New(1, 1)); err == nil {
		t.Fatal("expected an error for a mismatched frame")
	}
}
