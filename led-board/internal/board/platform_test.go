package board

import (
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
)

func TestParsePlatformPosition(t *testing.T) {
	for name, want := range map[string]PlatformPosition{"": PlatformHidden, "none": PlatformHidden, "before": PlatformBefore, "after": PlatformAfter} {
		if got, err := ParsePlatformPosition(name); err != nil || got != want {
			t.Errorf("ParsePlatformPosition(%q) = %d, %v; want %d", name, got, err, want)
		}
	}
	if _, err := ParsePlatformPosition("start"); err == nil {
		t.Error("an unknown position must be an error")
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
