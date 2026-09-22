// Command preview renders a board fixture over simulated time into PNG frames and a contact sheet, so the
// layout and animations can be checked on a desktop.
package main

import (
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/davwheat/led-departure-board/internal/board"
	"github.com/davwheat/led-departure-board/internal/daktronics"
	"github.com/davwheat/led-departure-board/internal/fixtures"
	"github.com/davwheat/led-departure-board/internal/font"
	"github.com/davwheat/led-departure-board/internal/frame"
	"github.com/davwheat/led-departure-board/internal/infotec"
)

func main() {
	fixture := flag.String("fixture", "busy-board", "fixture to render; one of "+fmt.Sprint(fixtures.Names))
	seconds := flag.Float64("seconds", 12, "simulated seconds to run")
	fps := flag.Int("fps", 50, "ticks per simulated second")
	scale := flag.Int("scale", 6, "pixels per dot in the frame PNGs")
	sheetScale := flag.Int("sheet-scale", 3, "pixels per dot in the contact sheet")
	every := flag.Float64("every", 0.5, "seconds between saved frames")
	columns := flag.Int("columns", 2, "frames per contact sheet row")
	out := flag.String("out", "preview-out", "output directory")
	stepAt := flag.Float64("step-at", 2, "seconds after which a fixture's second view is sent")
	boardName := flag.String("board", "daktronics", "board format: daktronics or infotec")
	worldline := flag.Bool("worldline", false, "render the Worldline-powered Daktronics variant")
	scrollSpeed := flag.Int("scroll-speed", 0, "scroll speed in dots per second; 0 uses the board's default")
	flag.Parse()

	steps := fixtures.Steps(*fixture)
	if steps == nil {
		fmt.Fprintf(os.Stderr, "unknown fixture %q\n", *fixture)
		os.Exit(2)
	}
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	dir := filepath.Join(*out, *fixture)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	const w, h = 256, 64
	b, err := newBoard(*boardName, w, h, zone, *worldline, *scrollSpeed)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	f := frame.New(w, h)
	b.Update(steps[0])

	tick := time.Second / time.Duration(*fps)
	ticks := int(*seconds * float64(*fps))
	saveEvery := max(int(*every*float64(*fps)), 1)
	stepTick := int(*stepAt * float64(*fps))
	var shots []shot
	changes := 0
	for i := 0; i <= ticks; i++ {
		now := fixtures.Clock.Add(time.Duration(i) * tick)
		if i == stepTick && len(steps) > 1 {
			b.Update(steps[1])
		}
		if b.Tick(now, f) {
			changes++
		}
		if i%saveEvery == 0 {
			t := float64(i) / float64(*fps)
			img := render(f, *scale)
			name := filepath.Join(dir, fmt.Sprintf("t%06.2f.png", t))
			if err := save(name, img); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			shots = append(shots, shot{t: t, img: render(f, *sheetScale)})
		}
	}
	sheet := contactSheet(shots, *columns, *sheetScale)
	name := filepath.Join(dir, "contact-sheet.png")
	if err := save(name, sheet); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("%s: %d ticks, %d redraws, %d frames, sheet %s\n", *fixture, ticks+1, changes, len(shots), name)
}

func newBoard(name string, w, h int, zone *time.Location, worldline bool, scrollSpeed int) (board.Board, error) {
	switch name {
	case "daktronics":
		return daktronics.New(daktronics.Config{Width: w, Height: h, Zone: zone, WorldlinePowered: worldline, ScrollSpeed: scrollSpeed}), nil
	case "infotec":
		return infotec.New(infotec.Config{Width: w, Height: h, Zone: zone, ScrollSpeed: scrollSpeed}), nil
	default:
		return nil, fmt.Errorf("unknown -board %q; want daktronics or infotec", name)
	}
}

type shot struct {
	t   float64
	img *image.RGBA
}

// render enlarges a frame, drawing each lit dot as a disc when the scale allows so the result resembles an LED
// panel.
func render(f *frame.Frame, scale int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, f.W*scale, f.H*scale))
	for i := 3; i < len(img.Pix); i += 4 {
		img.Pix[i] = 255
	}
	for y := range f.H {
		for x := range f.W {
			c := f.At(x, y)
			if c == frame.Black {
				continue
			}
			fillDot(img, x*scale, y*scale, scale, color.RGBA{c.R, c.G, c.B, 255})
		}
	}
	return img
}

func fillDot(img *image.RGBA, x0, y0, scale int, c color.RGBA) {
	if scale < 4 {
		for y := y0; y < y0+scale; y++ {
			for x := x0; x < x0+scale; x++ {
				img.SetRGBA(x, y, c)
			}
		}
		return
	}
	r := float64(scale)/2 - 0.5
	cx, cy := float64(x0)+float64(scale)/2, float64(y0)+float64(scale)/2
	for y := y0; y < y0+scale; y++ {
		for x := x0; x < x0+scale; x++ {
			dx, dy := float64(x)+0.5-cx, float64(y)+0.5-cy
			if dx*dx+dy*dy <= r*r {
				img.SetRGBA(x, y, c)
			}
		}
	}
}

func contactSheet(shots []shot, columns, scale int) *image.RGBA {
	if len(shots) == 0 {
		return image.NewRGBA(image.Rect(0, 0, 1, 1))
	}
	const gutter = 8
	labelH := font.Text.Height*2 + 4
	cellW := shots[0].img.Bounds().Dx() + gutter
	cellH := shots[0].img.Bounds().Dy() + labelH + gutter
	rows := (len(shots) + columns - 1) / columns
	sheet := image.NewRGBA(image.Rect(0, 0, columns*cellW+gutter, rows*cellH+gutter))
	for i := 0; i < len(sheet.Pix); i += 4 {
		copy(sheet.Pix[i:i+4], []byte{0x20, 0x20, 0x20, 0xff})
	}
	for i, s := range shots {
		x0 := gutter + (i%columns)*cellW
		y0 := gutter + (i/columns)*cellH
		drawLabel(sheet, x0, y0, fmt.Sprintf("t=%.2fs", s.t))
		b := s.img.Bounds()
		for y := 0; y < b.Dy(); y++ {
			for x := 0; x < b.Dx(); x++ {
				sheet.Set(x0+x, y0+labelH+y, s.img.At(x, y))
			}
		}
		frameRect(sheet, x0-1, y0+labelH-1, b.Dx()+2, b.Dy()+2)
	}
	return sheet
}

func drawLabel(img *image.RGBA, x0, y0 int, text string) {
	f := frame.New(font.Text.Width(text)+1, font.Text.Height)
	font.Text.Draw(f, 0, 0, text, frame.RGB{R: 255, G: 255, B: 255})
	for y := range f.H {
		for x := range f.W {
			if f.At(x, y) != frame.Black {
				for dy := range 2 {
					for dx := range 2 {
						img.SetRGBA(x0+2*x+dx, y0+2*y+dy, color.RGBA{255, 255, 255, 255})
					}
				}
			}
		}
	}
}

func frameRect(img *image.RGBA, x, y, w, h int) {
	c := color.RGBA{0x60, 0x60, 0x60, 255}
	for i := range w {
		img.SetRGBA(x+i, y, c)
		img.SetRGBA(x+i, y+h-1, c)
	}
	for i := range h {
		img.SetRGBA(x, y+i, c)
		img.SetRGBA(x+w-1, y+i, c)
	}
}

func save(name string, img image.Image) error {
	out, err := os.Create(name)
	if err != nil {
		return err
	}
	defer out.Close()
	return png.Encode(out, img)
}
