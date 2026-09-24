package matrix

import (
	"bytes"
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
		buffers[index].upload(f, func(y, height int) {
			start, end := y*f.W*3, (y+height)*f.W*3
			copy(canvases[index][start:end], f.Pix[start:end])
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
	b.upload(f, func(y, height int) {
		if y != 0 || height != f.H {
			t.Fatal("first upload must initialise the entire canvas")
		}
	})
	f.FillRect(0, 8, f.W, 3, frame.RGB{R: 255})
	f.FillRect(0, 60, f.W, 4, frame.RGB{G: 255})
	var got [][2]int
	b.upload(f, func(y, height int) { got = append(got, [2]int{y, height}) })
	if len(got) != 2 || got[0] != [2]int{8, 3} || got[1] != [2]int{60, 4} {
		t.Fatalf("changed row spans = %v", got)
	}
	b.upload(f, func(int, int) { t.Fatal("unchanged canvas was uploaded again") })
}
