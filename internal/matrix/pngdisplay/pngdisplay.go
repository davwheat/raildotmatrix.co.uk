// Package pngdisplay provides frame.Display implementations for machines
// without LED panels: one that writes every swapped frame to a PNG file and
// one that keeps the last frame in memory for tests.
package pngdisplay

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"sync"

	"github.com/davwheat/pi-departure-board/internal/frame"
)

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

// Writer is a frame.Display that saves each frame as a PNG.
type Writer struct {
	opts  Options
	count int
	img   *image.RGBA
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
		img:  image.NewRGBA(image.Rect(0, 0, opts.Width*opts.Scale, opts.Height*opts.Scale)),
	}, nil
}

// Size returns the configured panel size.
func (w *Writer) Size() (int, int) { return w.opts.Width, w.opts.Height }

// Swap writes f as the next numbered PNG in the output directory.
func (w *Writer) Swap(f *frame.Frame) error {
	if f.W != w.opts.Width || f.H != w.opts.Height {
		return fmt.Errorf("pngdisplay: frame is %dx%d, display is %dx%d", f.W, f.H, w.opts.Width, w.opts.Height)
	}
	scaleInto(w.img, f, w.opts.Scale)

	w.count++
	name := filepath.Join(w.opts.Dir, fmt.Sprintf("frame-%06d.png", w.count))
	out, err := os.Create(name)
	if err != nil {
		return fmt.Errorf("pngdisplay: %w", err)
	}
	if err := png.Encode(out, w.img); err != nil {
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
	img := image.NewRGBA(image.Rect(0, 0, f.W*scale, f.H*scale))
	scaleInto(img, f, scale)
	out, err := os.Create(path)
	if err != nil {
		return err
	}
	if err := png.Encode(out, img); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func scaleInto(img *image.RGBA, f *frame.Frame, scale int) {
	for y := 0; y < f.H; y++ {
		for x := 0; x < f.W; x++ {
			i := (y*f.W + x) * 3
			c := color.RGBA{f.Pix[i], f.Pix[i+1], f.Pix[i+2], 0xff}
			for dy := 0; dy < scale; dy++ {
				for dx := 0; dx < scale; dx++ {
					img.SetRGBA(x*scale+dx, y*scale+dy, c)
				}
			}
		}
	}
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

// Size returns the configured panel size.
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
