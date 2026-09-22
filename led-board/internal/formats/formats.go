// Package formats builds a board.Board by the name the user chose, so that every front end (the panel, the
// preview tool and the browser) offers the same formats with the same settings.
package formats

import (
	"fmt"
	"time"

	"github.com/davwheat/led-departure-board/internal/board"
	"github.com/davwheat/led-departure-board/internal/daktronics"
	"github.com/davwheat/led-departure-board/internal/frame"
	"github.com/davwheat/led-departure-board/internal/infotec"
)

// Names lists the board formats New accepts.
var Names = []string{"daktronics", "infotec"}

// Config is what every format is built from. Zero values mean each format's defaults.
type Config struct {
	Width, Height int
	Zone          *time.Location
	Colour        frame.RGB
	// Worldline selects the Daktronics variant with one scrolling information line. Other formats ignore it.
	Worldline bool
	// ScrollSpeed is in dots per second.
	ScrollSpeed int
}

// New returns the named board format.
func New(name string, c Config) (board.Board, error) {
	switch name {
	case "daktronics":
		return daktronics.New(daktronics.Config{
			Width: c.Width, Height: c.Height, Zone: c.Zone, Colour: c.Colour, WorldlinePowered: c.Worldline,
			ScrollSpeed: c.ScrollSpeed,
		}), nil
	case "infotec":
		return infotec.New(infotec.Config{
			Width: c.Width, Height: c.Height, Zone: c.Zone, Colour: c.Colour, ScrollSpeed: c.ScrollSpeed,
		}), nil
	default:
		return nil, fmt.Errorf("unknown board %q; want daktronics or infotec", name)
	}
}
