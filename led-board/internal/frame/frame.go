// Package frame holds the RGB framebuffer the board draws into and the display it is presented on.
package frame

type RGB struct{ R, G, B uint8 }

// Black is the unlit panel.
var Black = RGB{}

// Frame is a packed RGB framebuffer, row-major, three bytes per pixel.
type Frame struct {
	W, H int
	Pix  []byte
}

// New returns a black frame of the given size.
func New(w, h int) *Frame {
	return &Frame{W: w, H: h, Pix: make([]byte, w*h*3)}
}

// Set lights one pixel. Coordinates outside the frame are ignored so callers can draw partially off-screen.
func (f *Frame) Set(x, y int, c RGB) {
	if x < 0 || y < 0 || x >= f.W || y >= f.H {
		return
	}
	i := (y*f.W + x) * 3
	f.Pix[i] = c.R
	f.Pix[i+1] = c.G
	f.Pix[i+2] = c.B
}

// At returns the colour of one pixel, or black outside the frame.
func (f *Frame) At(x, y int) RGB {
	if x < 0 || y < 0 || x >= f.W || y >= f.H {
		return Black
	}
	i := (y*f.W + x) * 3
	return RGB{f.Pix[i], f.Pix[i+1], f.Pix[i+2]}
}

func (f *Frame) Clear() {
	clear(f.Pix)
}

// FillRect paints a rectangle, clipped to the frame.
func (f *Frame) FillRect(x, y, w, h int, c RGB) {
	x0, y0, x1, y1 := max(x, 0), max(y, 0), min(x+w, f.W), min(y+h, f.H)
	if x0 >= x1 || y0 >= y1 {
		return
	}
	stride, width := f.W*3, (x1-x0)*3
	start := y0*stride + x0*3
	row := f.Pix[start : start+width]
	for i := 0; i < len(row); i += 3 {
		row[i], row[i+1], row[i+2] = c.R, c.G, c.B
	}
	for yy := y0 + 1; yy < y1; yy++ {
		start += stride
		copy(f.Pix[start:start+width], row)
	}
}

func (f *Frame) Equal(o *Frame) bool {
	if f.W != o.W || f.H != o.H {
		return false
	}
	return string(f.Pix) == string(o.Pix)
}

// Display presents frames. Swap blocks until the frame is on screen so callers pace themselves to the panel.
type Display interface {
	Size() (w, h int)
	Swap(f *Frame) error
	Close() error
}

// VSyncer is implemented by displays with a fixed refresh rate. WaitVSync blocks until the next refresh without
// uploading a frame, so an animation loop can stay locked to the display even when nothing changed.
type VSyncer interface {
	WaitVSync() error
}

// Dimmer is implemented by displays whose brightness can change while they run. SetBrightness takes a percentage
// from 1 to 100; the caller redraws afterwards, since a display may only apply it to pixels written from then on.
type Dimmer interface {
	SetBrightness(percent int) error
}
