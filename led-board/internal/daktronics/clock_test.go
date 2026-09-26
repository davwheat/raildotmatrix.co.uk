package daktronics

import (
	"fmt"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestClockFlipClipsBothSidesOfGlyphEqually(t *testing.T) {
	cell := font.Clock.Advance('0')
	for digit := byte('0'); digit <= '9'; digit++ {
		t.Run(string(digit), func(t *testing.T) {
			var c clock
			c.update(fixtures.Clock, [8]byte{'1', '2', ':', '3', '4', ':', '5', digit})
			for elapsed := 0; elapsed <= 500; elapsed += 10 {
				d := c.scene(fixtures.Clock.Add(time.Duration(elapsed)*time.Millisecond), cell)[7]
				wantDigit := digit
				if elapsed < 250 {
					wantDigit = digit - 1
					if digit == '0' {
						wantDigit = '9'
					}
				}
				if d.ch != wantDigit {
					t.Fatalf("at %d ms: digit %c, want %c", elapsed, d.ch, wantDigit)
				}
				width := font.Clock.Glyphs[rune(d.ch)].Width
				left := (cell - width) / 2
				// Intersect the clip with the rendered glyph, excluding cell spacing.
				visibleLeft := max(int(d.left), left)
				visibleRight := min(int(d.right), left+width)
				if visibleRight > visibleLeft && visibleLeft-left != left+width-visibleRight {
					t.Errorf("at %d ms: digit %c loses %d columns on the left and %d on the right",
						elapsed, d.ch, visibleLeft-left, left+width-visibleRight)
				}
				if (elapsed == 0 || elapsed >= 450) && visibleRight-visibleLeft != width {
					t.Errorf("at %d ms: digit %c is not fully visible", elapsed, d.ch)
				}
				if elapsed == 250 && visibleRight > visibleLeft {
					t.Errorf("digit %c is visible at the midpoint of the flip", d.ch)
				}
			}
		})
	}
}

func TestClockFlipRendersCentreColumn(t *testing.T) {
	for _, size := range sizes {
		for _, phase := range []struct {
			name    string
			digit   byte
			elapsed time.Duration
		}{
			{"shrinking", '9', 150 * time.Millisecond}, // The outgoing digit is 8.
			{"growing", '8', 300 * time.Millisecond},
		} {
			t.Run(fmt.Sprintf("%dx%d/%s", size[0], size[1], phase.name), func(t *testing.T) {
				b := newSizedBoard(t, size[0], size[1], false)
				b.clock.update(fixtures.Clock, [8]byte{'1', '2', ':', '3', '4', ':', '5', phase.digit})
				s := b.clock.scene(fixtures.Clock.Add(phase.elapsed), b.geo.cell)
				// Draw only the last digit to check the actual glyph/clip alignment.
				isolated := clockScene{7: s[7]}
				f := frame.New(size[0], size[1])
				b.drawClock(f, &isolated)
				centreX := b.geo.clockX + 7*b.geo.cell + 3
				lit := 0
				for y := range f.H {
					for x := range f.W {
						if f.At(x, y) == frame.Black {
							continue
						}
						lit++
						if x != centreX {
							t.Errorf("dot at x=%d, want only the digit's centre column x=%d", x, centreX)
						}
					}
				}
				if lit != 3 { // The top, middle and bottom strokes of 8 cross its centre.
					t.Errorf("centre column has %d lit dots, want 3", lit)
				}
			})
		}
	}
}
