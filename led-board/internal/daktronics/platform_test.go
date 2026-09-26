package daktronics

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestRowPrefixColumn(t *testing.T) {
	const gap = 1
	ordinals := newGeometry(testW, testH, board.PrefixOrdinals)
	platforms := newGeometry(testW, testH, board.PrefixPlatforms)
	if ordinals.prefixW != (13*ordinals.ch+2)/4 || ordinals.stdX != ordinals.prefixW+gap {
		t.Errorf("ordinal prefix width %d, time at %d", ordinals.prefixW, ordinals.stdX)
	}
	if platforms.prefixW < font.Text.Width("Pl 10A") || platforms.stdX != platforms.prefixW+gap {
		t.Errorf("platform prefix width %d, time at %d", platforms.prefixW, platforms.stdX)
	}
	if platforms.destW != ordinals.destW+ordinals.prefixW-platforms.prefixW {
		t.Errorf("destination width %d; row must reserve only one prefix column", platforms.destW)
	}
}

func TestRowPrefixDrawn(t *testing.T) {
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name     string
		prefix   board.RowPrefix
		platform string
		want     [3]string
	}{
		{"ordinals", board.PrefixOrdinals, "10A", [3]string{"1st", "2nd", "3rd"}},
		{"platforms", board.PrefixPlatforms, "10A", [3]string{"Pl 10A", "Pl 10A", "Pl 10A"}},
		{"unpublished", board.PrefixPlatforms, "", [3]string{"", "", ""}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b := New(Config{Width: testW, Height: testH, Zone: zone, RowPrefix: tc.prefix})
			v := fixtures.Steps("busy-board")[0]
			for i := range v.Services {
				v.Services[i].Platform = tc.platform
			}
			b.Update(v)
			f := frame.New(testW, testH)
			// Let the first train finish its entrance before checking the pixels.
			b.Tick(fixtures.Clock, f)
			b.Tick(fixtures.Clock.Add(5*time.Second), f)
			for i, want := range tc.want {
				if got := b.content.rows[i].prefix; got != want {
					t.Errorf("row %d prefix = %q, want %q", i, got, want)
				}
			}
			expected := frame.New(testW, testH)
			y := b.geo.textY(0)
			board.DrawText(expected, font.Text, 0, y, tc.want[0], b.cfg.Colour, board.Clip{X1: testW, Y1: testH})
			for py := y; py < y+font.Text.Height; py++ {
				for x := 0; x < b.geo.stdX; x++ {
					if f.At(x, py) != expected.At(x, py) {
						t.Fatalf("prefix pixel (%d, %d) differs: must draw only %q before the time", x, py, tc.want[0])
					}
				}
			}
		})
	}
}

func TestWarningNamesPlatform(t *testing.T) {
	for _, c := range []struct {
		notice   model.Notice
		platform string
		line     int
		want     string
	}{
		{model.StandClear, "", 2, "to call at this station"},
		{model.StandClear, "10A", 2, "to call at platform 10A"},
		{model.NotForPublicUse, "", 1, "The next train is not"},
		{model.NotForPublicUse, "10A", 1, "The next train at platform 10A"},
	} {
		lines := warningLines(c.notice, c.platform)
		if lines[c.line] != c.want {
			t.Errorf("warning %d at %q: line %d = %q, want %q", c.notice, c.platform, c.line, lines[c.line], c.want)
		}
		for _, size := range sizes {
			for _, line := range lines {
				if w := font.Text.Width(line); w > size[0] {
					t.Errorf("%q is %d dots wide, wider than the %d-dot board", line, w, size[0])
				}
			}
		}
	}
}

func TestWarningPlatformIsOptional(t *testing.T) {
	v := fixtures.Steps("stand-clear")[0]
	for _, named := range []bool{false, true} {
		b := New(Config{Width: testW, Height: testH, WarningPlatform: named})
		b.Update(v)
		b.Tick(fixtures.Clock, frame.New(testW, testH))
		if got := b.content.warning != warningLines(v.Notice, ""); got != named {
			t.Errorf("WarningPlatform %v: warning %q", named, b.content.warning)
		}
	}
}
