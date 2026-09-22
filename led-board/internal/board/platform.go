package board

import (
	"fmt"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
)

// RowPrefix selects the single prefix shown before a train's scheduled time.
type RowPrefix uint8

const (
	PrefixOrdinals RowPrefix = iota
	PrefixPlatforms
)

// ParseRowPrefix returns the prefix that the row_prefix setting names: "ordinals" or "platforms".
func ParseRowPrefix(name string) (RowPrefix, error) {
	switch name {
	case "ordinals", "":
		return PrefixOrdinals, nil
	case "platforms":
		return PrefixPlatforms, nil
	}
	return 0, fmt.Errorf("unknown row prefix %q; want ordinals or platforms", name)
}

// Text returns the prefix for one of the board's three train rows, indexed from zero.
func (p RowPrefix) Text(index int, platform string) string {
	if p == PrefixPlatforms {
		return PlatformText(platform)
	}
	return [...]string{"1st", "2nd", "3rd"}[index]
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
