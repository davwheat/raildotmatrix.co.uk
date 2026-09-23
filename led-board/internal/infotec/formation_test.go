package infotec

import (
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
	"testing"
	"time"
)

func TestFormationRotationSynchronised(t *testing.T) {
	coaches := []model.Coach{
		{Label: "A", Loading: 50, Accessible: true, FirstClass: true},
		{Label: "B", Loading: -1, Accessible: true, Cycles: true, FirstClass: true},
		{Label: "C", Loading: 0},
	}
	want := [][2]string{{"A", "B"}, {"", ""}, {"§", "§"}, {"§", "#"}, {"1st", "1st"}, {"A", "B"}}
	for i, pair := range want {
		for _, offset := range []time.Duration{0, 4999 * time.Millisecond} {
			got := formationContents(coaches, time.Duration(i)*5*time.Second+offset)
			if got[0].text != pair[0] || got[1].text != pair[1] {
				t.Fatalf("slot %d: %+v", i, got[:3])
			}
			if i == 1 && (got[0].loading != 50 || got[1].loading != -1 || got[2].loading != 0) {
				t.Fatalf("loading unknown/zero lost: %+v", got[:3])
			}
		}
	}
}

func TestLoadingFillAndCoachBorders(t *testing.T) {
	f := frame.New(100, 11)
	contents := formationContents([]model.Coach{{Loading: 50}, {Loading: 100}, {Loading: -1}, {Loading: 0}}, 0)
	drawFormation(f, 0, 0, 100, 11, 4, board.White)
	before := append([]byte(nil), f.Pix...)
	drawFormationContents(f, 0, 0, 100, 11, 4, contents, board.White)
	dim := board.Scale(board.White, 1, 2)
	counts := [4]int{}
	for y := 0; y < 11; y++ {
		for x := 0; x < 61; x++ {
			if f.At(x, y) == dim {
				if y == 0 || y == 10 {
					t.Fatal("loading filled a border")
				}
				counts[(x-5)/14]++
			}
			pos := (y*f.W + x) * 3
			if before[pos] != 0 && f.At(x, y) != board.White {
				t.Fatal("loading overwrote outline")
			}
		}
	}
	if counts != [4]int{65, 117, 0, 0} {
		t.Fatalf("fill areas: %v", counts)
	}
}

func TestFormationUpdateRedrawsAtSameTime(t *testing.T) {
	b := New(Config{Width: 256, Height: 64, PlatformBox: "2"})
	v := fixtures.Steps("busy-board")[0]
	v.Services[0].Coaches = []model.Coach{{Loading: 10}}
	b.Update(v)
	f := frame.New(256, 64)
	now := fixtures.Clock.Add(time.Second)
	b.Tick(now, f)
	v.Services[0].Coaches = []model.Coach{{Loading: 90}}
	b.Update(v)
	if !b.Tick(now, f) {
		t.Fatal("loading-only update did not redraw")
	}
	if b.last.coachContents[0].loading != 90 {
		t.Fatal("stale loading")
	}
	v.Services[0].Coaches = nil
	b.Update(v)
	b.Tick(now, f)
	if b.last.coachContents[0].text != "" || b.last.coachContents[0].loading != 0 {
		t.Fatal("stale formation after removal")
	}
}
