// Package testpattern draws the pictures that the setup wizard asks about. The manager writes a request file, and
// the board shows the pattern in place of the departures until the request ends.
package testpattern

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Names are the patterns a request can name: one primary colour, the three primaries side by side, or the outline
// and number of each panel.
var Names = []string{"red", "green", "blue", "colours", "layout"}

// Request asks the board to show Pattern until Until. The deadline returns an abandoned wizard's board to normal.
type Request struct {
	Pattern string    `json:"pattern"`
	Until   time.Time `json:"until"`
}

func (r Request) Showing(now time.Time) bool {
	return slices.Contains(Names, r.Pattern) && now.Before(r.Until)
}

// Path is the request file, beside the network status file that the manager also writes for the board.
func Path(setupStatus string) string {
	return filepath.Join(filepath.Dir(setupStatus), "test-pattern.json")
}

// Read returns the request in the file at path. A missing or unreadable file requests nothing.
func Read(path string) Request {
	var r Request
	if data, err := os.ReadFile(path); err == nil {
		json.Unmarshal(data, &r)
	}
	return r
}

var (
	red   = frame.RGB{R: 255}
	green = frame.RGB{G: 255}
	blue  = frame.RGB{B: 255}
	white = frame.RGB{R: 255, G: 255, B: 255}
)

// Draw draws the pattern named into f, which is made of panels panelW by panelH dots.
func Draw(f *frame.Frame, pattern string, panelW, panelH int) {
	f.Clear()
	switch pattern {
	case "red":
		checker(f, 0, f.W, red)
	case "green":
		checker(f, 0, f.W, green)
	case "blue":
		checker(f, 0, f.W, blue)
	case "colours":
		third := f.W / 3
		checker(f, 0, third, red)
		checker(f, third, 2*third, green)
		checker(f, 2*third, f.W, blue)
	case "layout":
		layout(f, max(1, panelW), max(1, panelH))
	}
}

// Lighting every other dot shows the colour as plainly as a solid fill, at half the current. A solid fill across
// every panel can draw more than a small power supply gives.
func checker(f *frame.Frame, x0, x1 int, c frame.RGB) {
	for y := range f.H {
		for x := x0 + (x0+y)%2; x < x1; x += 2 {
			f.Set(x, y, c)
		}
	}
}

// Each panel is outlined and numbered in the order the frame lays them out, so a panel that's missing, repeated,
// out of order or the wrong size stands out.
func layout(f *frame.Frame, panelW, panelH int) {
	n := 0
	for y := 0; y < f.H; y += panelH {
		for x := 0; x < f.W; x += panelW {
			n++
			w, h := min(panelW, f.W-x), min(panelH, f.H-y)
			f.FillRect(x, y, w, 1, white)
			f.FillRect(x, y+h-1, w, 1, white)
			f.FillRect(x, y, 1, h, white)
			f.FillRect(x+w-1, y, 1, h, white)
			label := "Panel " + strconv.Itoa(n)
			font.Text.Draw(f, x+(w-font.Text.Width(label))/2, y+(h-font.Text.Height)/2, label, white)
		}
	}
}
