package infotec

import (
	"slices"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestCoachLetterTOCs(t *testing.T) {
	defaults := []string{"VT", "GR", "GW", "LD", "LF", "GC", "HT", "SR", "AW", "EM"}
	for _, toc := range append(defaults, "SN", "SE", "", "ZZ") {
		for _, tc := range []struct {
			name    string
			allowed []string
			show    bool
		}{
			{"defaults", nil, slices.Contains(defaults, toc)},
			{"custom", []string{"SN"}, toc == "SN"},
			{"empty", []string{}, false},
			{"case and whitespace", []string{" sn ", " gw "}, toc == "SN" || toc == "GW"},
		} {
			t.Run(toc+"/"+tc.name, func(t *testing.T) {
				coach := model.Coach{Label: "A", Loading: 50, Accessible: true, Cycles: true, Toilet: true, Food: true, FirstClass: true}
				v := model.View{Services: []model.Service{{TOCCode: toc, Coaches: []model.Coach{coach}}}}
				b := New(Config{CoachLetterTOCs: tc.allowed})
				row := b.derive(v).rows[0]
				want := coach
				if !tc.show {
					want.Label = ""
				}
				if row.coaches[0] != want || row.length != 1 {
					t.Fatalf("formation = %+v, length %d; want %+v, length 1", row.coaches, row.length, want)
				}
				if v.Services[0].Coaches[0] != coach {
					t.Fatal("display filtering mutated the feed's coach data")
				}
				// Suppressed letters must not leave an empty slot before loading and facilities.
				elapsed := time.Duration(0)
				if tc.show {
					if got := b.formationContents(row.coaches, elapsed)[0]; got.text != "A" {
						t.Fatalf("letter page = %+v", got)
					}
					elapsed += 5 * time.Second
				}
				if got := b.formationContents(row.coaches, elapsed)[0]; got.loading != 50 || got.text != "" {
					t.Fatalf("loading page = %+v", got)
				}
				for _, icon := range []string{"§", "#", "€", "1st"} {
					elapsed += 5 * time.Second
					if got := b.formationContents(row.coaches, elapsed)[0]; got.text != icon {
						t.Fatalf("facility page = %+v, want %s", got, icon)
					}
				}
			})
		}
	}
}

func TestCoachLettersFollowOperatorUpdates(t *testing.T) {
	b := New(Config{Width: 256, Height: 64, PlatformBox: "2"})
	v := fixtures.Steps("single-departure")[0]
	v.Services[0].Coaches = []model.Coach{{Label: "A", Loading: 50}}
	f := frame.New(256, 64)
	now := fixtures.Clock.Add(time.Second)
	for _, toc := range []string{"GW", "SN", "GW", "", "GW"} {
		v.Services[0].TOCCode = toc
		b.Update(v)
		if !b.Tick(now, f) {
			t.Fatalf("operator change to %q did not redraw", toc)
		}
		want := coachContent{loading: 50}
		if toc == "GW" {
			want = coachContent{text: "A", loading: -1}
		}
		if got := b.last.coachContents[0]; got != want {
			t.Fatalf("operator %q: coach contents = %+v, want %+v", toc, got, want)
		}
	}
}

func TestFormationRotationSynchronised(t *testing.T) {
	b := New(Config{})
	coaches := []model.Coach{
		{Label: "A", Loading: 50, Accessible: true, Toilet: true, FirstClass: true},
		{Label: "B", Loading: -1, Accessible: true, Cycles: true, Toilet: true, Food: true, FirstClass: true},
		{Label: "C", Loading: 0},
		{Label: "D", Loading: -1, Toilet: true},
	}
	want := [][4]string{
		{"A", "B", "C", "D"}, {"", "", "", ""},
		{"§", "§", "", "±"}, {"§", "#", "", "±"}, {"§", "€", "", "±"}, {"1st", "1st", "", "±"},
		{"A", "B", "C", "D"},
	}
	for i, pair := range want {
		for _, offset := range []time.Duration{0, 4999 * time.Millisecond} {
			got := b.formationContents(coaches, time.Duration(i)*5*time.Second+offset)
			for c, text := range pair {
				if got[c].text != text {
					t.Fatalf("slot %d: %+v", i, got[:len(coaches)])
				}
			}
			if i == 1 && (got[0].loading != 50 || got[1].loading != -1 || got[2].loading != 0) {
				t.Fatalf("loading unknown/zero lost: %+v", got[:3])
			}
		}
	}
}

func TestEnabledFormationIcons(t *testing.T) {
	coaches := []model.Coach{
		{Loading: -1, Accessible: true, Cycles: true, Toilet: true, Food: true, FirstClass: true},
		{Loading: -1, Toilet: true},
	}
	for _, tc := range []struct {
		name  string
		icons []string
		pages [][2]string
	}{
		{"defaults", nil, [][2]string{{"§", "±"}, {"#", "±"}, {"€", "±"}, {"1st", "±"}}},
		{"no toilets", []string{"accessibility", "cycles", "food", "first-class"}, [][2]string{{"§", ""}, {"#", ""}, {"€", ""}, {"1st", ""}}},
		{"accessibility only", []string{"accessibility"}, [][2]string{{"§", ""}}},
		{"cycles only", []string{"cycles"}, [][2]string{{"#", ""}}},
		{"toilets only", []string{"toilets"}, [][2]string{{"±", "±"}}},
		{"food only", []string{"food"}, [][2]string{{"€", ""}}},
		{"first class only", []string{"first-class"}, [][2]string{{"1st", ""}}},
		{"empty", []string{}, [][2]string{{"", ""}}},
		{"priority ignores list order and duplicates", []string{"first-class", "toilets", "accessibility", "accessibility"}, [][2]string{{"§", "±"}, {"1st", "±"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b := New(Config{FormationIcons: tc.icons})
			// Check two full cycles: disabled icons must not leave blank pages.
			for slot := 0; slot < 2*len(tc.pages); slot++ {
				got := b.formationContents(coaches, time.Duration(slot)*5*time.Second)
				want := tc.pages[slot%len(tc.pages)]
				if got[0].text != want[0] || got[1].text != want[1] {
					t.Fatalf("slot %d: contents = %+v, want %v", slot, got[:2], want)
				}
			}
		})
	}
	// Hiding icons must preserve identifier and loading pages.
	b := New(Config{FormationIcons: []string{}})
	coaches[0].Label, coaches[0].Loading = "A", 50
	for slot, want := range []coachContent{{text: "A", loading: -1}, {loading: 50}, {text: "A", loading: -1}} {
		if got := b.formationContents(coaches, time.Duration(slot)*5*time.Second)[0]; got != want {
			t.Fatalf("icons disabled, slot %d: %+v, want %+v", slot, got, want)
		}
	}
}

func TestLoadingFillAndCoachBorders(t *testing.T) {
	b := New(Config{})
	f := frame.New(100, 11)
	contents := b.formationContents([]model.Coach{{Loading: 50}, {Loading: 100}, {Loading: -1}, {Loading: 0}}, 0)
	drawFormation(f, 0, 0, 100, 11, 4, board.White)
	before := append([]byte(nil), f.Pix...)
	drawFormationContents(f, 0, 0, 100, 11, 4, &contents, board.White, 50)
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
	v.Services[0].Coaches = []model.Coach{{Loading: -1, Toilet: true}}
	b.Update(v)
	if !b.Tick(now, f) || b.last.coachContents[0].text != "±" {
		t.Fatal("toilet-only formation did not redraw")
	}
	v.Services[0].Coaches = []model.Coach{{Loading: -1, Food: true}}
	b.Update(v)
	if !b.Tick(now, f) || b.last.coachContents[0].text != "€" {
		t.Fatal("food-only formation did not redraw")
	}
	v.Services[0].Coaches = []model.Coach{{Loading: -1}}
	b.Update(v)
	if !b.Tick(now, f) || b.last.coachContents[0].text != "" {
		t.Fatal("stale icon after facility removal")
	}
	v.Services[0].Coaches = nil
	b.Update(v)
	b.Tick(now, f)
	if b.last.coachContents[0].text != "" || b.last.coachContents[0].loading != 0 {
		t.Fatal("stale formation after removal")
	}
}

func TestLoadingBrightnessPreservesFillArea(t *testing.T) {
	b := New(Config{})
	for _, brightness := range []int{50, 100} {
		f := frame.New(40, 11)
		contents := b.formationContents([]model.Coach{{Loading: 50}}, 0)
		drawFormationContents(f, 0, 0, 40, 11, 1, &contents, board.White, brightness)
		expected := board.Scale(board.White, brightness, 100)
		lit := 0
		for y := 0; y < f.H; y++ {
			for x := 0; x < f.W; x++ {
				c := f.At(x, y)
				if c != frame.Black {
					lit++
					if c != expected {
						t.Fatalf("brightness %d: colour %v", brightness, c)
					}
				}
			}
		}
		if lit != 65 {
			t.Fatalf("brightness %d changed fill area: %d", brightness, lit)
		}
	}
}
