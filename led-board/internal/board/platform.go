package board

import (
	"fmt"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
)

// PlatformPosition is where a train row shows its platform number, relative to the "1st" ordinal.
type PlatformPosition uint8

const (
	PlatformHidden PlatformPosition = iota
	PlatformBefore
	PlatformAfter
)

// ParsePlatformPosition returns the position that the platform_position setting names: "none", "before" or
// "after".
func ParsePlatformPosition(name string) (PlatformPosition, error) {
	switch name {
	case "none", "":
		return PlatformHidden, nil
	case "before":
		return PlatformBefore, nil
	case "after":
		return PlatformAfter, nil
	}
	return 0, fmt.Errorf("unknown platform position %q; want none, before, or after", name)
}

// PlatformText is what a row shows in its platform column. A row whose platform isn't published shows nothing
// rather than a placeholder.
func PlatformText(number string) string {
	if number == "" {
		return ""
	}
	return "Pl " + number
}

// maxPlatformLength is the longest platform number the column makes room for, such as "10A".
const maxPlatformLength = 3

// PlatformWidth is the width of a platform column in f: room for "Pl " and a number of maxPlatformLength of
// its widest digit or capital, so that the columns after it stay put whatever the platform.
func PlatformWidth(f *font.Face) int {
	widest := 0
	for _, r := range "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
		widest = max(widest, f.Advance(r))
	}
	return f.Width("Pl ") + maxPlatformLength*widest
}
