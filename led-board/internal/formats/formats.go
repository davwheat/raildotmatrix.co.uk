// Package formats builds a board.Board by the name the user chose, so that every front end (the panel, the
// preview tool and the browser) offers the same formats with the same settings.
package formats

import (
	"fmt"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/daktronics"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/infotec"
)

// Names lists the board formats New accepts.
var Names = []string{"daktronics", "infotec"}

// Config is what every format is built from. Zero values mean each format's defaults.
type Config struct {
	OrdinalFormat board.OrdinalFormat
	ServiceCount  int
	// CompactLowerRow places a smaller lower service row beside the clock.
	CompactLowerRow *bool
	Width, Height   int
	Zone            *time.Location
	Colour          frame.RGB
	// Worldline selects the Daktronics variant with one scrolling information line. Other formats ignore it.
	Worldline bool
	// ScrollSpeed is in dots per second.
	ScrollSpeed int
	// RowPrefix selects ordinals or platform numbers before each train's time.
	RowPrefix board.RowPrefix
	// WarningPlatform names the platform in a warning when the warning is for one platform.
	WarningPlatform bool
	// PlatformBox shows the requested platform, or the first service's platform when watching several.
	PlatformBox bool
	// AlignPlatformRows aligns lower service columns with the platform box; nil defaults to true.
	AlignPlatformRows *bool
	Platforms         []string
}

// New returns the named board format.
func New(name string, c Config) (board.Board, error) {
	if c.ServiceCount < 0 || c.ServiceCount > 6 {
		return nil, fmt.Errorf("service count must be between 1 and 6")
	}
	switch name {
	case "daktronics":
		return daktronics.New(daktronics.Config{
			Width: c.Width, Height: c.Height, Zone: c.Zone, Colour: c.Colour, WorldlinePowered: c.Worldline,
			ScrollSpeed: c.ScrollSpeed, RowPrefix: c.RowPrefix, OrdinalFormat: c.OrdinalFormat, WarningPlatform: c.WarningPlatform,
		}), nil
	case "infotec":
		platformBox := ""
		if c.PlatformBox && len(c.Platforms) == 1 {
			platformBox = strings.ToUpper(strings.TrimSpace(c.Platforms[0]))
		}
		return infotec.New(infotec.Config{
			Width: c.Width, Height: c.Height, Zone: c.Zone, Colour: c.Colour, ScrollSpeed: c.ScrollSpeed,
			RowPrefix: c.RowPrefix, OrdinalFormat: c.OrdinalFormat, WarningPlatform: c.WarningPlatform,
			ServiceCount: c.ServiceCount, CompactLowerRow: c.CompactLowerRow, PlatformBox: platformBox, ServicePlatformBox: c.PlatformBox && platformBox == "", AlignPlatformRows: c.AlignPlatformRows,
		}), nil
	default:
		return nil, fmt.Errorf("unknown board %q; want daktronics or infotec", name)
	}
}
