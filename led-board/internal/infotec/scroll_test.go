package infotec

import (
	"strings"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestScrollingFontControlsTextFit(t *testing.T) {
	for _, small := range []bool{false, true} {
		b := New(Config{Width: 256, Height: 64, SmallScrollingText: small})
		// This page fits only in the small font: 174 dots versus 209 in a 201-dot area.
		p := page{prefix: "Calling at:", text: strings.Repeat("g", 35), hold: callingHold}
		b.info.reset(p, &b.geo, fixtures.Clock)
		if b.info.static != small {
			t.Fatalf("small=%v: static=%v, text width=%d, available=%d", small, b.info.static, b.info.textW, b.info.outerW)
		}
		// Longer text must still scroll completely offscreen, using its selected font's width.
		p.text = strings.Repeat("g", 60)
		b.info.reset(p, &b.geo, fixtures.Clock)
		if b.info.static {
			t.Fatal("long page did not scroll")
		}
		face := font.PISTall
		if small {
			face = font.InfotecSmall
		}
		end := fixtures.Clock.Add(time.Duration(scrollPauseAtEnds+(face.Width(p.text)+b.info.outerW)*1000/DefaultScrollSpeed) * time.Millisecond)
		b.info.advance(end.Add(-time.Millisecond))
		if b.info.phase != scrollMoving {
			t.Fatal("scroll finished before the last character left the row")
		}
		b.info.advance(end)
		if b.info.phase != scrollGone {
			t.Fatal("scroll continued after the last character left the row")
		}
	}
}

func TestSmallScrollingTextClipsAnimation(t *testing.T) {
	for _, size := range sizes {
		for _, box := range []string{"", "2"} {
			b := New(Config{Width: size[0], Height: size[1], PlatformBox: box, SmallScrollingText: true})
			g := &b.geo
			for _, p := range []page{
				{text: "A Southern service.", hold: infoHold},
				{prefix: "Front 12 coaches:", text: strings.Repeat("Brighton, ", 12), hold: callingHold},
			} {
				b.info.reset(p, g, fixtures.Clock)
				if p.prefix != "" && b.info.x0 < g.infoX+font.InfotecSmall.Width(p.prefix)+prefixSpacing {
					t.Fatal("calling points overlap their prefix")
				}
				for elapsed := time.Duration(0); elapsed < 8*time.Second; elapsed += tick {
					now := fixtures.Clock.Add(elapsed)
					b.info.advance(now)
					sc := b.info.scene(now)
					f := frame.New(g.w, g.h)
					if sc.on {
						b.drawInfo(f, &sc, board.White)
					}
					if x, y, lit := litOutside(f, [2]int{g.infoY, g.infoY + font.InfotecSmall.Height}); lit {
						t.Fatalf("%dx%d box=%q at %v: information pixel outside small row at (%d,%d)", g.w, g.h, box, elapsed, x, y)
					}
				}
			}
		}
	}
}

func TestSmallScrollingTextSpacesRows(t *testing.T) {
	for _, size := range sizes {
		for _, clock := range []string{"normal", "small-seconds", "small"} {
			for _, layout := range []struct {
				name, box string
				compact   *bool
			}{
				{name: "no platform box"},
				{name: "separate clock", box: "2", compact: &separateClock},
				{name: "compact", box: "2"},
			} {
				b := New(Config{Width: size[0], Height: size[1], ClockStyle: clock, PlatformBox: layout.box, CompactLowerRow: layout.compact, SmallScrollingText: true})
				g := b.geometry(true)
				lowerTop := g.secondY
				if g.compact {
					lowerTop = min(lowerTop, g.clockY)
				}
				if g.infoY < g.firstY+font.PISTall.Height || g.formationY < g.infoY+font.InfotecSmall.Height+1 ||
					g.sepY < g.formationY+g.formationH+2 || lowerTop < g.sepY+3 {
					t.Fatalf("%dx%d %s %s: insufficient spacing between rows: %+v", size[0], size[1], clock, layout.name, g)
				}
				if g.formationH != 11 {
					t.Fatal("spacing must preserve the full-height formation")
				}
			}
		}
	}
}
