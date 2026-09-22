package pngdisplay

import (
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/davwheat/pi-departure-board/internal/frame"
)

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
