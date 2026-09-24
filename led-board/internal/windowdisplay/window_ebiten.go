//go:build !linux

package windowdisplay

import (
	"errors"
	"fmt"
	"image"
	"image/color"
	"sync"
	"time"

	"github.com/hajimehoshi/ebiten/v2"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// swapWait bounds how long Swap waits for the window to take a frame, so a
// paused window loop (for example while the window is hidden) slows the
// application down instead of stopping it.
const swapWait = 100 * time.Millisecond

// Run opens the window and calls app in a new goroutine with a
// [frame.Display] that draws into it. Run must be called from the main
// goroutine, and it returns when the window is closed, when Esc is pressed,
// or when app returns. The display keeps working until Run returns; after
// that, Swap returns [ErrClosed], which is how app learns that the window has
// gone. Run doesn't wait for app to return in that case.
//
// The display's Swap copies the frame and then blocks until the window has
// taken it, which paces the caller to the window's tick rate much like the
// real panel's Swap blocks on vsync. The wait is capped at 100 ms so that a
// hidden window can't stall the caller.
func Run(opts Options, app func(d frame.Display)) error {
	opts = opts.withDefaults()
	if opts.Width <= 0 || opts.Height <= 0 {
		return fmt.Errorf("windowdisplay: invalid size %dx%d", opts.Width, opts.Height)
	}

	d := &display{
		opts:    opts,
		pending: frame.New(opts.Width, opts.Height),
		taken:   make(chan struct{}, 1),
		closed:  make(chan struct{}),
		appDone: make(chan struct{}),
	}
	renderer, err := newDotRenderer(opts)
	if err != nil {
		return err
	}
	defer renderer.dispose()
	g := &game{d: d, renderer: renderer}

	ebiten.SetWindowTitle(opts.Title)
	ebiten.SetWindowSize(opts.Width*opts.Scale, opts.Height*opts.Scale)
	ebiten.SetWindowResizingMode(ebiten.WindowResizingModeEnabled)

	go func() {
		defer close(d.appDone)
		app(d)
	}()

	err = ebiten.RunGame(g)
	close(d.closed)
	if errors.Is(err, ebiten.Termination) {
		return nil
	}
	return err
}

// display is the frame.Display handed to the application. Frames arrive on
// the application goroutine and are consumed on the window's goroutine.
type display struct {
	opts Options

	mu      sync.Mutex
	pending *frame.Frame
	dirty   bool

	taken   chan struct{}
	closed  chan struct{}
	appDone chan struct{}
}

func (d *display) Size() (w, h int) { return d.opts.Width, d.opts.Height }

// Swap hands f to the window and waits for it to be taken. See [Run] for the
// pacing behaviour.
func (d *display) Swap(f *frame.Frame) error {
	if f.W != d.opts.Width || f.H != d.opts.Height {
		return fmt.Errorf("windowdisplay: frame is %dx%d, display is %dx%d", f.W, f.H, d.opts.Width, d.opts.Height)
	}
	select {
	case <-d.closed:
		return ErrClosed
	default:
	}

	d.mu.Lock()
	// A token left over from an earlier frame would end the wait below early.
	// take sends under the same lock, so any token present here is stale.
	select {
	case <-d.taken:
	default:
	}
	copy(d.pending.Pix, f.Pix)
	d.dirty = true
	d.mu.Unlock()

	select {
	case <-d.taken:
	case <-d.closed:
		return ErrClosed
	case <-time.After(swapWait):
	}
	return nil
}

// Close is a no-op; the window is owned by [Run].
func (d *display) Close() error { return nil }

// take copies the pending frame into f and reports whether there was one.
func (d *display) take(f *frame.Frame) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.dirty {
		return false
	}
	copy(f.Pix, d.pending.Pix)
	d.dirty = false
	select {
	case d.taken <- struct{}{}:
	default:
	}
	return true
}

// game implements ebiten.Game. The panel is rendered into canvas only when a
// new frame arrives; Draw then blits the canvas at every window refresh.
type game struct {
	d        *display
	renderer *dotRenderer
	last     *frame.Frame
}

func (g *game) Update() error {
	select {
	case <-g.d.appDone:
		return ebiten.Termination
	default:
	}
	if ebiten.IsKeyPressed(ebiten.KeyEscape) {
		return ebiten.Termination
	}
	if g.last == nil {
		g.last = frame.New(g.d.opts.Width, g.d.opts.Height)
	}
	if g.d.take(g.last) {
		g.renderer.render(g.last)
	}
	return nil
}

func (g *game) Draw(screen *ebiten.Image) {
	screen.DrawImage(g.renderer.canvas, nil)
}

func (g *game) Layout(int, int) (int, int) {
	return g.renderer.canvas.Bounds().Dx(), g.renderer.canvas.Bounds().Dy()
}

// newDot renders one white LED: an anti-aliased disc that leaves a gap to
// its neighbours. The shader uses its alpha as the coverage of each LED.
func newDot(scale int) *ebiten.Image {
	const samples = 4
	gap := max(1, scale/5)
	if scale == 1 {
		gap = 0
	}
	radius := float64(scale-gap) / 2
	centre := float64(scale) / 2

	img := image.NewRGBA(image.Rect(0, 0, scale, scale))
	for y := range scale {
		for x := range scale {
			inside := 0
			for sy := range samples {
				for sx := range samples {
					px := float64(x) + (float64(sx)+0.5)/samples - centre
					py := float64(y) + (float64(sy)+0.5)/samples - centre
					if px*px+py*py <= radius*radius {
						inside++
					}
				}
			}
			v := uint8(255 * inside / (samples * samples))
			img.SetRGBA(x, y, color.RGBA{v, v, v, v})
		}
	}
	return ebiten.NewImageFromImage(img)
}
