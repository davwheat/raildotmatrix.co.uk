package frame

import (
	"math/rand/v2"
	"testing"
)

func TestFillRectClipping(t *testing.T) {
	rng := rand.New(rand.NewPCG(14, 23))
	for range 3000 {
		w, h := rng.IntN(100), rng.IntN(100)
		got, want := New(w, h), New(w, h)
		for i := range got.Pix {
			got.Pix[i] = byte(rng.Uint32())
		}
		copy(want.Pix, got.Pix)
		x, y, rw, rh := rng.IntN(200)-100, rng.IntN(200)-100, rng.IntN(200)-50, rng.IntN(200)-50
		c := RGB{R: byte(rng.Uint32()), G: byte(rng.Uint32()), B: byte(rng.Uint32())}
		got.FillRect(x, y, rw, rh, c)
		for yy := max(y, 0); yy < min(y+rh, h); yy++ {
			for xx := max(x, 0); xx < min(x+rw, w); xx++ {
				want.Set(xx, yy, c)
			}
		}
		if !got.Equal(want) {
			t.Fatalf("frame %dx%d, rectangle %d,%d %dx%d", w, h, x, y, rw, rh)
		}
	}
}
