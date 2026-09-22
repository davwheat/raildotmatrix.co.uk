package board

import (
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
)

func TestParseRowPrefix(t *testing.T) {
	for name, want := range map[string]RowPrefix{"": PrefixOrdinals, "ordinals": PrefixOrdinals, "platforms": PrefixPlatforms} {
		if got, err := ParseRowPrefix(name); err != nil || got != want {
			t.Errorf("ParseRowPrefix(%q) = %d, %v; want %d", name, got, err, want)
		}
	}
	for _, name := range []string{"none", "before", "after", "both", "unknown"} {
		if _, err := ParseRowPrefix(name); err == nil {
			t.Errorf("unsupported prefix %q must be an error", name)
		}
	}
}

func TestPlatformWidthFitsThreeCharacters(t *testing.T) {
	for _, f := range []*font.Face{font.Text, font.PISTall} {
		for _, number := range []string{"1", "10A", "888", "WWW", "MMM"} {
			if w := f.Width(PlatformText(number)); w > PlatformWidth(f) {
				t.Errorf("%q is %d dots wide, more than the column's %d", PlatformText(number), w, PlatformWidth(f))
			}
		}
	}
	if PlatformText("") != "" {
		t.Error("an unknown platform must leave the column blank")
	}
}
