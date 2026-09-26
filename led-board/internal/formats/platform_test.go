package formats

import (
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestPlatformBoxWorksWithAnyPlatformFilter(t *testing.T) {
	for _, format := range Names {
		for _, platforms := range [][]string{nil, {""}, {" "}, {"2"}, {"1", "2"}, {"2", "2"}} {
			frames := [2]*frame.Frame{}
			for i, enabled := range []bool{false, true} {
				b, err := New(format, Config{Width: 256, Height: 64, PlatformBox: enabled, Platforms: platforms})
				if err != nil {
					t.Fatal(err)
				}
				frames[i] = frame.New(256, 64)
				// Every train is on platform 2; the box also works without a single-platform filter.
				v := fixtures.Steps("busy-board")[0]
				for j := range v.Services {
					v.Services[j].Platform = "2"
				}
				b.Update(v)
				b.Tick(fixtures.Clock, frames[i])
			}
			wantBox := format == "infotec"
			if changed := !frames[0].Equal(frames[1]); changed != wantBox {
				t.Errorf("%s, requested %q: box changed frame = %v, want %v", format, platforms, changed, wantBox)
			}
		}
	}
}
