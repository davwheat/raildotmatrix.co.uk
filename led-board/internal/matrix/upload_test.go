package matrix

import (
	"bytes"
	"math/rand/v2"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestUploadsKeepBothCanvasesCurrent(t *testing.T) {
	f := frame.New(19, 9)
	var buffers [2]uploadBuffer
	canvases := [2][]byte{make([]byte, len(f.Pix)), make([]byte, len(f.Pix))}
	index := 0
	for tick := range 80 {
		// Animate one row, occasionally blank everything or force a brightness re-encode. Repeat some
		// frames so correctness depends on the off-screen canvas, rather than only the last shown image.
		if tick%3 != 0 {
			f.FillRect(0, tick%f.H, f.W, 1, frame.RGB{R: uint8(tick), G: uint8(tick * 2)})
		}
		if tick%17 == 0 {
			f.Clear()
		}
		if tick%19 == 0 {
			for i := range buffers {
				buffers[i].valid = false
				// A new brightness changes native colours despite identical source pixels.
				for j := range canvases[i] {
					canvases[i][j] = 255
				}
			}
		}
		buffers[index].upload(f, func(x, y, width, height int) {
			copyRect(canvases[index], f, x, y, width, height)
		})
		if !bytes.Equal(canvases[index], f.Pix) {
			t.Fatalf("stale pixels at tick %d in canvas %d", tick, index)
		}
		index = 1 - index
	}
}

func TestUploadsCoalesceRowsAndSkipUnchangedPixels(t *testing.T) {
	f := frame.New(256, 64)
	var b uploadBuffer
	b.upload(f, func(x, y, width, height int) {
		if x != 0 || y != 0 || width != f.W || height != f.H {
			t.Fatal("first upload must initialise the entire canvas")
		}
	})
	f.FillRect(0, 8, f.W, 3, frame.RGB{R: 255})
	f.FillRect(0, 60, f.W, 4, frame.RGB{G: 255})
	var got [][2]int
	b.upload(f, func(x, y, width, height int) {
		if x != 0 || width != f.W {
			t.Fatal("full-width changes must upload the full width")
		}
		got = append(got, [2]int{y, height})
	})
	if len(got) != 2 || got[0] != [2]int{8, 3} || got[1] != [2]int{60, 4} {
		t.Fatalf("changed row spans = %v", got)
	}
	b.upload(f, func(int, int, int, int) { t.Fatal("unchanged canvas was uploaded again") })
}

func copyRect(dst []byte, f *frame.Frame, x, y, width, height int) {
	for row := y; row < y+height; row++ {
		start := (row*f.W + x) * 3
		copy(dst[start:start+width*3], f.Pix[start:start+width*3])
	}
}

func TestUploadCropsColumnsAndIncludesEachColourChannel(t *testing.T) {
	f := frame.New(256, 64)
	var b uploadBuffer
	b.upload(f, func(int, int, int, int) {})
	f.FillRect(107, 8, 13, 3, frame.RGB{B: 1})
	f.Set(105, 9, frame.RGB{R: 1})
	f.Set(121, 10, frame.RGB{G: 1})
	f.Set(255, 63, frame.RGB{B: 1})
	var got [][4]int
	b.upload(f, func(x, y, width, height int) { got = append(got, [4]int{x, y, width, height}) })
	want := [][4]int{{105, 8, 17, 3}, {255, 63, 1, 1}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("changed rectangles = %v, want %v", got, want)
	}
}

func TestUploadsPreservePixelsAcrossRandomRectangles(t *testing.T) {
	rng := rand.New(rand.NewPCG(3, 5))
	f := frame.New(71, 37)
	var buffers [2]uploadBuffer
	canvases := [2][]byte{make([]byte, len(f.Pix)), make([]byte, len(f.Pix))}
	for tick := range 1000 {
		x, y := rng.IntN(f.W), rng.IntN(f.H)
		f.FillRect(x, y, rng.IntN(f.W), rng.IntN(f.H), frame.RGB{R: uint8(rng.Uint32()), G: uint8(rng.Uint32()), B: uint8(rng.Uint32())})
		if tick%23 == 0 {
			f.Clear()
		}
		index := tick % 2
		buffers[index].upload(f, func(x, y, width, height int) {
			if x < 0 || y < 0 || width <= 0 || height <= 0 || x+width > f.W || y+height > f.H {
				t.Fatalf("invalid rectangle: %d,%d %dx%d", x, y, width, height)
			}
			copyRect(canvases[index], f, x, y, width, height)
		})
		if !bytes.Equal(canvases[index], f.Pix) {
			t.Fatalf("stale pixels at tick %d in canvas %d", tick, index)
		}
	}
}
