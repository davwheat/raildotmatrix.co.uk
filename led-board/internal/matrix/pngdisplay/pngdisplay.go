// Package pngdisplay provides frame.Display implementations for machines
// without LED panels: one that writes every swapped frame to a PNG file and
// one that keeps the last frame in memory for tests.
package pngdisplay

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"sync"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// PNG's compression workspace is much larger than a board frame. Reuse it across
// images and allow concurrent exports, with separate pools for each compression level.
type encoderBuffers struct{ sync.Pool }

func (p *encoderBuffers) Get() *png.EncoderBuffer {
	b, _ := p.Pool.Get().(*png.EncoderBuffer)
	return b
}

func (p *encoderBuffers) Put(b *png.EncoderBuffer) { p.Pool.Put(b) }

var encoder = png.Encoder{BufferPool: &encoderBuffers{}}

// Continuous frame output favours throughput. Keep a separate workspace so
// compact one-off exports do not repeatedly reinitialise the compression level.
var streamEncoder = png.Encoder{CompressionLevel: png.BestSpeed, BufferPool: &encoderBuffers{}}

// Options configures a PNG-writing display.
type Options struct {
	// Dir receives the frames as frame-000001.png, frame-000002.png, and so
	// on. It is created if it does not exist.
	Dir string

	// Scale is the integer factor each panel pixel is enlarged by. Values
	// below 1 are treated as 1.
	Scale int

	// Width and Height are the panel size to report from Size.
	Width, Height int
}

// Writer is a frame.Display that saves each frame as a lossless PNG. It favours
// encoding speed over file size; Encode uses compact encoding for one-off exports.
type Writer struct {
	opts    Options
	count   int
	img     *image.RGBA
	indexed paletteFrame
}

// New creates the output directory and returns a Writer of the given size.
func New(opts Options) (*Writer, error) {
	if opts.Scale < 1 {
		opts.Scale = 1
	}
	if opts.Width <= 0 || opts.Height <= 0 {
		return nil, fmt.Errorf("pngdisplay: invalid size %dx%d", opts.Width, opts.Height)
	}
	if err := os.MkdirAll(opts.Dir, 0o755); err != nil {
		return nil, fmt.Errorf("pngdisplay: %w", err)
	}
	return &Writer{
		opts: opts,
	}, nil
}

func (w *Writer) Size() (int, int) { return w.opts.Width, w.opts.Height }

// Swap writes f as the next numbered PNG in the output directory.
func (w *Writer) Swap(f *frame.Frame) error {
	if f.W != w.opts.Width || f.H != w.opts.Height {
		return fmt.Errorf("pngdisplay: frame is %dx%d, display is %dx%d", f.W, f.H, w.opts.Width, w.opts.Height)
	}
	var img image.Image
	if indexed := w.indexed.scaleForStream(f, w.opts.Scale); indexed != nil {
		img = indexed
	} else {
		if w.img == nil {
			w.img = image.NewRGBA(image.Rect(0, 0, f.W*w.opts.Scale, f.H*w.opts.Scale))
		}
		scaleInto(w.img, f, w.opts.Scale)
		img = w.img
	}

	w.count++
	name := filepath.Join(w.opts.Dir, fmt.Sprintf("frame-%06d.png", w.count))
	out, err := os.Create(name)
	if err != nil {
		return fmt.Errorf("pngdisplay: %w", err)
	}
	if err := streamEncoder.Encode(out, img); err != nil {
		out.Close()
		return fmt.Errorf("pngdisplay: %w", err)
	}
	return out.Close()
}

// Close is a no-op; every frame is already on disk.
func (w *Writer) Close() error { return nil }

// Count reports how many frames have been written.
func (w *Writer) Count() int { return w.count }

// Encode writes f to path as a PNG enlarged by scale. It is a convenience for
// one-off snapshots outside a Writer.
func Encode(path string, f *frame.Frame, scale int) error {
	if scale < 1 {
		scale = 1
	}
	var indexed paletteFrame
	if img := indexed.scale(f, scale); img != nil {
		return EncodeImage(path, img)
	}
	img := image.NewRGBA(image.Rect(0, 0, f.W*scale, f.H*scale))
	scaleInto(img, f, scale)
	return EncodeImage(path, img)
}

// EncodeImage saves an already-rendered image, reusing the PNG compression workspace across snapshots.
func EncodeImage(path string, img image.Image) error {
	out, err := os.Create(path)
	if err != nil {
		return err
	}
	if err := encoder.Encode(out, img); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func scaleInto(img *image.RGBA, f *frame.Frame, scale int) {
	for y := 0; y < f.H; y++ {
		start := img.PixOffset(img.Rect.Min.X, img.Rect.Min.Y+y*scale)
		row := img.Pix[start : start+f.W*scale*4]
		for x := 0; x < f.W; x++ {
			i := (y*f.W + x) * 3
			for to := x * scale * 4; to < (x+1)*scale*4; to += 4 {
				row[to], row[to+1], row[to+2], row[to+3] = f.Pix[i], f.Pix[i+1], f.Pix[i+2], 255
			}
		}
		// All remaining rows of this enlarged source row are identical.
		for dy := 1; dy < scale; dy++ {
			to := start + dy*img.Stride
			copy(img.Pix[to:to+len(row)], row)
		}
	}
}

// dotsRGBA is the exact-colour fallback for frames whose dots and black
// background cannot be represented by a PNG palette.
func dotsRGBA(f *frame.Frame, scale int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, f.W*scale, f.H*scale))
	for i := 3; i < len(img.Pix); i += 4 {
		img.Pix[i] = 255
	}
	spans := dotSpans(scale)
	for y := range f.H {
		for x := range f.W {
			c := f.At(x, y)
			if c == frame.Black {
				continue
			}
			for dy, span := range spans {
				start := (y*scale+dy)*img.Stride + (x*scale+span.start)*4
				end := start + (span.end-span.start)*4
				for i := start; i < end; i += 4 {
					img.Pix[i], img.Pix[i+1], img.Pix[i+2] = c.R, c.G, c.B
				}
			}
		}
	}
	return img
}

type dotSpan struct{ start, end int }

// Every LED has the same silhouette. Calculate its horizontal spans once per image, rather than testing the
// circle equation for every output pixel of every lit LED.
func dotSpans(scale int) []dotSpan {
	spans := make([]dotSpan, scale)
	r := float64(scale)/2 - 0.5
	centre := float64(scale) / 2
	for y := range scale {
		if scale < 4 {
			spans[y] = dotSpan{0, scale}
			continue
		}
		spans[y].start = scale
		for x := range scale {
			dx, dy := float64(x)+0.5-centre, float64(y)+0.5-centre
			if dx*dx+dy*dy <= r*r {
				spans[y].start = min(spans[y].start, x)
				spans[y].end = x + 1
			}
		}
	}
	return spans
}

// Sink is a frame.Display that keeps a copy of the most recent frame. It is
// safe for concurrent use.
type Sink struct {
	w, h int

	mu    sync.Mutex
	last  *frame.Frame
	swaps int
}

// NewSink returns a Sink reporting the given size.
func NewSink(w, h int) *Sink {
	return &Sink{w: w, h: h}
}

func (s *Sink) Size() (int, int) { return s.w, s.h }

// Swap copies f so later mutations by the caller don't affect Last.
func (s *Sink) Swap(f *frame.Frame) error {
	if f.W != s.w || f.H != s.h {
		return fmt.Errorf("pngdisplay: frame is %dx%d, sink is %dx%d", f.W, f.H, s.w, s.h)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.last == nil {
		s.last = frame.New(f.W, f.H)
	}
	copy(s.last.Pix, f.Pix)
	s.swaps++
	return nil
}

// Close is a no-op.
func (s *Sink) Close() error { return nil }

// Last returns a copy of the most recently swapped frame, or nil if none.
func (s *Sink) Last() *frame.Frame {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.last == nil {
		return nil
	}
	out := frame.New(s.last.W, s.last.H)
	copy(out.Pix, s.last.Pix)
	return out
}

// Swaps reports how many frames have been presented.
func (s *Sink) Swaps() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.swaps
}
