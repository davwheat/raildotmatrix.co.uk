//go:build !linux && renderertest

package windowdisplay

import (
	"fmt"
	"image/color"
	"os"
	"testing"

	"github.com/hajimehoshi/ebiten/v2"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// GPU readback needs Ebitengine's run loop. Keep these checks opt-in so ordinary Go tests do not open a window.
func TestMain(m *testing.M) {
	g := &rendererTestGame{m: m}
	ebiten.SetWindowSize(64, 64)
	ebiten.SetWindowTitle("LED renderer tests")
	if err := ebiten.RunGame(g); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(g.code)
}

type rendererTestGame struct {
	m    *testing.M
	code int
}

func (g *rendererTestGame) Update() error {
	g.code = g.m.Run()
	return ebiten.Termination
}
func (*rendererTestGame) Draw(*ebiten.Image)         {}
func (*rendererTestGame) Layout(int, int) (int, int) { return 64, 64 }

// Retain the previous rendering algorithm as the reference, including its black background and alpha blending.
func renderReference(canvas, dot *ebiten.Image, f *frame.Frame, scale int) {
	canvas.Fill(color.Black)
	op := &ebiten.DrawImageOptions{}
	for y := range f.H {
		for x := range f.W {
			c := f.At(x, y)
			if c == frame.Black {
				continue
			}
			op.GeoM.Reset()
			op.GeoM.Translate(float64(x*scale), float64(y*scale))
			op.ColorScale.Reset()
			op.ColorScale.Scale(float32(c.R)/255, float32(c.G)/255, float32(c.B)/255, 1)
			canvas.DrawImage(dot, op)
		}
	}
}

func patternedFrame(w, h int) *frame.Frame {
	f := frame.New(w, h)
	colours := [...]frame.RGB{{}, {230, 150, 0}, {239, 239, 239}, {115, 75, 0}, {0, 0, 255}, {0, 255, 0}}
	for y := range h {
		for x := range w {
			f.Set(x, y, colours[(x+3*y)%len(colours)])
		}
	}
	return f
}

func TestShaderMatchesDotDraws(t *testing.T) {
	for _, size := range [][2]int{{193, 36}, {272, 70}, {256, 64}} {
		for _, scale := range []int{1, 2, 3, 5, 6, 9} {
			t.Run(fmt.Sprintf("%dx%d/scale-%d", size[0], size[1], scale), func(t *testing.T) {
				r, err := newDotRenderer(Options{Width: size[0], Height: size[1], Scale: scale})
				if err != nil {
					t.Fatal(err)
				}
				defer r.dispose()
				ref := ebiten.NewImage(size[0]*scale, size[1]*scale)
				defer ref.Deallocate()
				f := patternedFrame(size[0], size[1])
				want := make([]byte, size[0]*size[1]*scale*scale*4)
				got := make([]byte, len(want))
				for _, blank := range []bool{false, true} {
					if blank {
						f.Clear()
					}
					r.render(f)
					renderReference(ref, r.dot, f, scale)
					r.canvas.ReadPixels(got)
					ref.ReadPixels(want)
					for i := range want {
						if delta := int(got[i]) - int(want[i]); delta < -1 || delta > 1 {
							t.Fatalf("blank=%t channel %d: got %d, want %d", blank, i, got[i], want[i])
						}
					}
				}
			})
		}
	}
}

// Readback flushes queued GPU work each iteration, so this measures completed renders rather than growing a
// command queue. Both paths pay the same readback cost, which a real window does not incur.
func BenchmarkRender(b *testing.B) {
	for _, mode := range []string{"per-dot", "shader"} {
		b.Run(mode, func(b *testing.B) {
			const scale = 5
			r, err := newDotRenderer(Options{Width: 256, Height: 64, Scale: scale})
			if err != nil {
				b.Fatal(err)
			}
			defer r.dispose()
			f := patternedFrame(256, 64)
			// About one in five LEDs is lit on a typical text board.
			for y := range f.H {
				for x := range f.W {
					if (x+y)%5 != 0 {
						f.Set(x, y, frame.Black)
					}
				}
			}
			pixels := make([]byte, f.W*f.H*scale*scale*4)
			r.render(f)
			r.canvas.ReadPixels(pixels)
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				if mode == "per-dot" {
					renderReference(r.canvas, r.dot, f, scale)
				} else {
					r.render(f)
				}
				r.canvas.ReadPixels(pixels)
			}
		})
	}
}
