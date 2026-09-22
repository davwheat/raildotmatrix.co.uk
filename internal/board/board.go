// Package board is what every departure board format shares: the interface the app drives a board through,
// the text colours, and the dot-level drawing helpers. The formats themselves live in their own packages.
package board

import (
	"fmt"
	"time"

	"github.com/davwheat/pi-departure-board/internal/frame"
	"github.com/davwheat/pi-departure-board/internal/model"
)

// Board is a departure board format: a state machine that turns the live view into frames. Update may be
// called from any goroutine; Tick must be called from one goroutine only.
type Board interface {
	// Update replaces the view. It takes effect on the next Tick.
	Update(model.View)
	// Tick advances the board to now and, when the picture changed, redraws it into f. It reports whether f
	// changed; a caller can skip the panel swap otherwise.
	Tick(now time.Time, f *frame.Frame) bool
	// RefreshHz is the panel refresh rate the board's animations are designed for: an integer multiple of its
	// scroll rate in dots per second, so that every scroll step lasts a whole number of refreshes.
	RefreshHz() int
}

// MinRefreshHz is the slowest panel refresh a board may ask for. The panel strobes at its refresh rate, and
// 60 Hz was judged steady enough on this hardware.
const MinRefreshHz = 60

// RefreshFor returns the lowest multiple of a scroll speed, in dots per second, that is at least MinRefreshHz,
// which is the refresh rate at which every scroll step lasts a whole number of refreshes.
func RefreshFor(scrollSpeed int) int {
	return scrollSpeed * ((MinRefreshHz + scrollSpeed - 1) / scrollSpeed)
}

// Text colours a board can be shown in.
var (
	// Amber is the web boards' text colour, hsl(39, 100%, 45%).
	Amber = frame.RGB{R: 230, G: 150, B: 0}
	White = frame.RGB{R: 0xEF, G: 0xEF, B: 0xEF}
)

// Scale returns c at num/den of its brightness, which is what a web board's opacity does against a black
// background.
func Scale(c frame.RGB, num, den int) frame.RGB {
	return frame.RGB{
		R: uint8(int(c.R) * num / den),
		G: uint8(int(c.G) * num / den),
		B: uint8(int(c.B) * num / den),
	}
}

// ParseColour returns the colour named on the command line: "amber" or "white".
func ParseColour(name string) (frame.RGB, error) {
	switch name {
	case "amber":
		return Amber, nil
	case "white":
		return White, nil
	}
	return frame.RGB{}, fmt.Errorf("unknown colour %q; want amber or white", name)
}
