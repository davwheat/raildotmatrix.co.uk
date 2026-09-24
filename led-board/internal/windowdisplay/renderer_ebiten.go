//go:build !linux

package windowdisplay

import (
	_ "embed"
	"fmt"

	"github.com/hajimehoshi/ebiten/v2"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

//go:embed dots.kage
var dotShader []byte

// dotRenderer uploads one low-resolution frame and draws all LEDs in one shader call. The dot texture is the
// same antialiased disc used by the former per-LED DrawImage loop, so scaling does not change their appearance.
type dotRenderer struct {
	canvas, source, dot *ebiten.Image
	shader              *ebiten.Shader
	pixels              []byte
	vertices            [4]ebiten.Vertex
	options             ebiten.DrawTrianglesShaderOptions
}

var quadIndices = [...]uint16{0, 1, 2, 1, 3, 2}

func newDotRenderer(opts Options) (*dotRenderer, error) {
	shader, err := ebiten.NewShader(dotShader)
	if err != nil {
		return nil, fmt.Errorf("windowdisplay: compile dot shader: %w", err)
	}
	w, h := opts.Width*opts.Scale, opts.Height*opts.Scale
	r := &dotRenderer{
		canvas: ebiten.NewImage(w, h),
		source: ebiten.NewImage(opts.Width, opts.Height),
		dot:    newDot(opts.Scale),
		shader: shader,
		pixels: make([]byte, opts.Width*opts.Height*4),
		vertices: [4]ebiten.Vertex{
			{},
			{DstX: float32(w), SrcX: float32(w)},
			{DstY: float32(h), SrcY: float32(h)},
			{DstX: float32(w), DstY: float32(h), SrcX: float32(w), SrcY: float32(h)},
		},
	}
	for i := 3; i < len(r.pixels); i += 4 {
		r.pixels[i] = 255
	}
	r.options = ebiten.DrawTrianglesShaderOptions{
		Blend:    ebiten.BlendCopy,
		Images:   [4]*ebiten.Image{r.source, r.dot},
		Uniforms: map[string]any{"Scale": float32(opts.Scale)},
	}
	return r, nil
}

func (r *dotRenderer) render(f *frame.Frame) {
	for from, to := 0, 0; from < len(f.Pix); from, to = from+3, to+4 {
		r.pixels[to] = f.Pix[from]
		r.pixels[to+1] = f.Pix[from+1]
		r.pixels[to+2] = f.Pix[from+2]
	}
	r.source.WritePixels(r.pixels)
	// The shader writes opaque black between LEDs, replacing the previous frame without a separate clear.
	r.canvas.DrawTrianglesShader(r.vertices[:], quadIndices[:], r.shader, &r.options)
}

func (r *dotRenderer) dispose() {
	r.canvas.Deallocate()
	r.source.Deallocate()
	r.dot.Deallocate()
	r.shader.Deallocate()
}
