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

func TestPlatformColumn(t *testing.T) {
	const gap = 1
	hidden := newGeometry(testW, testH, board.PlatformHidden)
	for _, position := range []board.PlatformPosition{board.PlatformBefore, board.PlatformAfter} {
		g := newGeometry(testW, testH, position)
		ordinalW := (13*g.ch + 2) / 4
		first, second := g.platX, g.ordinalX
		firstW := g.platW
		if position == board.PlatformAfter {
			first, second, firstW = g.ordinalX, g.platX, ordinalW
		}
		if first != 0 || second != firstW+gap || g.stdX != g.platW+ordinalW+2*gap {
			t.Errorf("position %d: platform at %d, ordinal at %d, std at %d", position, g.platX, g.ordinalX, g.stdX)
		}
		if g.platW < font.Text.Width("Pl 10A") || g.destW != hidden.destW-g.platW-gap {
			t.Errorf("position %d: platform width %d, destination width %d", position, g.platW, g.destW)
		}
	}
}

func TestPlatformDrawn(t *testing.T) {
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Fatal(err)
	}
	for _, position := range []board.PlatformPosition{board.PlatformHidden, board.PlatformBefore, board.PlatformAfter} {
		b := New(Config{Width: testW, Height: testH, Zone: zone, Platform: position})
		b.Update(fixtures.Steps("busy-board")[0])
		f := frame.New(testW, testH)
		// The first train slides in before it settles.
		b.Tick(fixtures.Clock, f)
		b.Tick(fixtures.Clock.Add(5*time.Second), f)
		if got, want := b.content.rows[1].platform != "", position != board.PlatformHidden; got != want {
			t.Errorf("position %d: platform %q", position, b.content.rows[1].platform)
		}
		lit := false
		for y := range font.Text.Height {
			for x := b.geo.platX; x < b.geo.platX+b.geo.platW; x++ {
				lit = lit || f.At(x, y) != frame.Black
			}
		}
		if lit != (position != board.PlatformHidden) {
			t.Errorf("position %d: platform column lit = %v", position, lit)
		}
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
