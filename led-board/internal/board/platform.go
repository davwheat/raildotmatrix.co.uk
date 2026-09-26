package board

import (
	"fmt"
	"strconv"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
)

type OrdinalFormat uint8

const (
	OrdinalSuffix OrdinalFormat = iota
	OrdinalDot
)

func ParseOrdinalFormat(name string) (OrdinalFormat, error) {
	switch name {
	case "", "suffix":
		return OrdinalSuffix, nil
	case "dot":
		return OrdinalDot, nil
	}
	return 0, fmt.Errorf("unknown ordinal format %q; want suffix or dot", name)
}

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

// Text returns the prefix for a train row, indexed from zero.
func (p RowPrefix) Text(index int, platform string, format ...OrdinalFormat) string {
	if p == PrefixPlatforms {
		return PlatformText(platform)
	}
	n := index + 1
	if len(format) > 0 && format[0] == OrdinalDot {
		return strconv.Itoa(n) + "."
	}
	suffix := "th"
	if n%100 < 11 || n%100 > 13 {
		switch n % 10 {
		case 1:
			suffix = "st"
		case 2:
			suffix = "nd"
		case 3:
			suffix = "rd"
		}
	}
	return strconv.Itoa(n) + suffix
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
