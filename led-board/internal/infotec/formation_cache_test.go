package infotec

import (
	"math/rand/v2"
	"slices"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestCachedFormationMatchesFreshPages(t *testing.T) {
	rng := rand.New(rand.NewPCG(83, 54))
	b := New(Config{})
	var coaches []model.Coach
	var previous *[128]coachContent
	var previousValue [128]coachContent
	for tick := range 5000 {
		if tick%7 == 0 {
			coaches = make([]model.Coach, rng.IntN(140))
			for i := range coaches {
				coaches[i] = model.Coach{Label: []string{"", "A", "B"}[rng.IntN(3)], Loading: rng.IntN(103) - 2,
					Accessible: rng.IntN(2) == 0, Cycles: rng.IntN(2) == 0, Toilet: rng.IntN(2) == 0,
					Food: rng.IntN(2) == 0, FirstClass: rng.IntN(2) == 0}
			}
		} else if tick%3 == 0 {
			coaches = slices.Clone(coaches) // Identical data from a new feed update.
		}
		elapsed := time.Duration(tick%120-10) * time.Second
		got := b.cachedFormation(coaches, elapsed)
		if previous != nil && *previous != previousValue {
			t.Fatal("changed the preceding scene before it could be compared")
		}
		want := b.formationContents(coaches, elapsed)
		if *got != want {
			t.Fatalf("tick %d: cached formation differs", tick)
		}
		if previous != nil && *got == previousValue && len(coaches) != 0 && got != previous {
			t.Fatal("identical formation unnecessarily changed scene identity")
		}
		previous, previousValue = got, *got
	}
}
