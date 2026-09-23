package infotec

import (
	"fmt"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestFormationCountFit(t *testing.T) {
	for _, tc := range []struct{ style, format string }{
		{"number", "(%d)"},
		{"coaches", "(%d coaches)"},
		{"coaches-no-brackets", "%d coaches"},
		{"carriages", "(%d carriages)"},
		{"carriages-no-brackets", "%d carriages"},
	} {
		for _, length := range []int{1, 4, 12} {
			label := fmt.Sprintf(tc.format, length)
			graphic := 5 + 14*length
			fits := graphic + 4 + font.InfotecSmall.Width(label)
			for _, width := range []int{fits - 1, fits, fits + 1} {
				t.Run(fmt.Sprintf("%s/%d/%d", tc.style, length, width), func(t *testing.T) {
					w, got := formationCountLayout(width, 11, length, tc.style)
					want := label
					if width < fits {
						want = fmt.Sprintf("(%d)", length)
					}
					if got != want || w+4+font.InfotecSmall.Width(got) > width {
						t.Fatalf("width %d: graphic %d, label %q, want %q fitting on board", width, w, got, want)
					}
					if tc.style != "number" && w != graphic {
						t.Fatalf("graphic narrowed to %d to fit wording, want %d", w, graphic)
					}
				})
			}
		}
	}
}

func TestFormationCountPixels(t *testing.T) {
	for _, tc := range []struct {
		style, label                       string
		width, length, graphic, textHeight int
	}{
		{"", "", 256, 4, 61, 0},
		{"none", "", 256, 4, 61, 0},
		{"number", "(4)", 256, 4, 61, 8},
		{"coaches", "(4 coaches)", 256, 4, 61, 8},
		{"coaches-no-brackets", "4 coaches", 256, 4, 61, 8},
		{"carriages", "(4 carriages)", 256, 4, 61, 10},
		{"carriages-no-brackets", "4 carriages", 256, 4, 61, 10},
		{"coaches", "(4)", 100, 4, 61, 8},
		{"coaches-no-brackets", "(4)", 100, 4, 61, 8},
		{"carriages", "(4)", 100, 4, 61, 8},
		{"carriages-no-brackets", "(4)", 100, 4, 61, 8},
		{"carriages", "(12)", 160, 12, 137, 8},
		{"carriages-no-brackets", "(12)", 160, 12, 137, 8},
		{"number", "", 20, 4, 17, 0},
		{"coaches", "", 256, 0, 0, 0},
		{"carriages", "", 256, -1, 0, 0},
		{"number", "", 256, 100, 0, 0},
	} {
		t.Run(fmt.Sprintf("%s/%d/%d", tc.style, tc.width, tc.length), func(t *testing.T) {
			const x, y, height = 23, 7, 11
			b := New(Config{FormationCount: tc.style})
			b.geo = geometry{w: x + tc.width, infoX: x, formationY: y, formationH: height}
			f := frame.New(b.geo.w, 24)
			s := scene{formation: tc.length}
			b.drawTrainFormation(f, &s, board.White)
			want := frame.New(f.W, f.H)
			drawFormation(want, x, y, tc.graphic, height, tc.length, board.White)
			textX := x + tc.graphic + 4
			font.InfotecSmall.Draw(want, textX, y+height-tc.textHeight, tc.label, board.White)
			if !f.Equal(want) {
				t.Fatal("formation or label pixels differ: check wording, four-pixel gap and bottom alignment")
			}
			if tc.label == "" {
				return
			}
			minX, maxY := f.W, -1
			for yy := range f.H {
				for xx := x + tc.graphic; xx < f.W; xx++ {
					if f.At(xx, yy) != frame.Black {
						minX, maxY = min(minX, xx), max(maxY, yy)
					}
				}
			}
			if minX != textX || maxY != y+height-1 {
				t.Fatalf("label starts at %d, ends on row %d; want %d, %d", minX, maxY, textX, y+height-1)
			}
		})
	}
}

func TestFormationCountFollowsServiceLength(t *testing.T) {
	for _, size := range sizes {
		for _, platformBox := range []string{"", "2", "10A"} {
			b := New(Config{Width: size[0], Height: size[1], PlatformBox: platformBox, FormationCount: "carriages"})
			plain := New(Config{Width: size[0], Height: size[1], PlatformBox: platformBox})
			f, without := frame.New(size[0], size[1]), frame.New(size[0], size[1])
			v := fixtures.Steps("single-departure")[0]
			for _, length := range []int{4, 12, 1, 0, -1} {
				v.Services[0].Length = length
				b.Update(v)
				plain.Update(v)
				b.Tick(fixtures.Clock, f)
				plain.Tick(fixtures.Clock, without)
				if f.Equal(without) != (length <= 0) {
					t.Fatalf("size %v, platform %q, length %d: count visibility wrong", size, platformBox, length)
				}
				g := b.geo
				for y := range f.H {
					for x := range f.W {
						if y >= g.formationY && y < g.formationY+g.formationH && x >= g.infoX {
							continue
						}
						if f.At(x, y) != without.At(x, y) {
							t.Fatalf("count changed pixels outside formation at (%d,%d)", x, y)
						}
					}
				}
			}
		}
	}
}
