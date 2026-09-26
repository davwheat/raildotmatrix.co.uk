package infotec

import (
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"testing"
	"time"
)

func TestClockModesAndExpectedTimeGap(t *testing.T) {
	for _, style := range []string{"normal", "small-seconds", "small"} {
		for _, size := range sizes {
			b := New(Config{Width: size[0], Height: size[1], PlatformBox: "2", ClockStyle: style})
			g := b.geo
			if g.clockX+g.clockWidth() != g.w {
				t.Fatalf("clock %s not right aligned", style)
			}
			for _, etd := range []string{"On time", "Delayed", "Cancelled", "1234", "1231"} {
				f := frame.New(g.w, g.h)
				b.drawCompactRow(f, &rowScene{std: "1200", etd: etd, etdLevel: fadeLevels}, board.White)
				last := -1
				for x := 0; x < g.w; x++ {
					for y := g.secondY; y < g.h; y++ {
						if f.At(x, y) != frame.Black {
							last = max(last, x)
						}
					}
				}
				if g.clockX-last-1 != 4 {
					t.Fatalf("%s/%s gap=%d, want 4", style, etd, g.clockX-last-1)
				}
			}
			f := frame.New(g.w, g.h)
			b.drawClock(f, [8]byte{'1', '2', ':', '3', '4', ':', '5', '6'})
			if style == "small-seconds" {
				gap := g.clockX + 4*font.InfotecClock.Advance('0') + font.InfotecClock.Advance(':')
				for x := gap; x < gap+2; x++ {
					for y := 0; y < g.h; y++ {
						if f.At(x, y) != frame.Black {
							t.Fatal("colon before small seconds")
						}
					}
				}
			}
		}
	}
}

func TestGapFollowsNarrowFirstClockDigit(t *testing.T) {
	for _, style := range []string{"normal", "small-seconds", "small"} {
		b := New(Config{Width: 256, Height: 64, PlatformBox: "2", ClockStyle: style})
		now := time.Date(2026, 1, 1, 12, 34, 56, 0, time.UTC)
		b.Update(fixtures.Steps("busy-board")[0])
		b.Tick(now, frame.New(256, 64))
		row := frame.New(256, 64)
		clock := frame.New(256, 64)
		b.drawCompactRow(row, &rowScene{std: "1200", etd: "On time", etdLevel: fadeLevels}, board.White)
		b.drawClock(clock, clockDigits(now, time.UTC))
		right, left := -1, 256
		for y := 0; y < 64; y++ {
			for x := 0; x < 256; x++ {
				if row.At(x, y) != frame.Black {
					right = max(right, x)
				}
				if clock.At(x, y) != frame.Black {
					left = min(left, x)
				}
			}
		}
		if left-right-1 != 4 {
			t.Fatalf("%s gap %d", style, left-right-1)
		}
	}
}
