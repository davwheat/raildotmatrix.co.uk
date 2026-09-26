package live

import (
	"fmt"
	"math/rand"
	"slices"
	"testing"
)

func TestDeltaPlatformAlterationsMatchesFullState(t *testing.T) {
	base, _ := projectionFixture(t)
	prototype := *base.Movements[base.Ordering[0]]
	state := base
	rng := rand.New(rand.NewSource(7491))
	for step := range 1000 {
		previous := state
		var message Message
		if step%31 == 0 {
			snapshot := &Snapshot{Epoch: base.Epoch, Revision: uint64(step + 1)}
			for i := range 20 {
				movement := prototype
				movement.ID = fmt.Sprint(i)
				movement.Platform.Number = ptr([]string{"2", "5", "a", ""}[rng.Intn(4)])
				snapshot.Movements = append(snapshot.Movements, movement)
			}
			message = snapshot
		} else {
			update := &Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1}
			for range rng.Intn(10) {
				movement := prototype
				movement.ID = fmt.Sprint(rng.Intn(30))
				movement.Platform.Number = ptr([]string{"2", "5", "a", ""}[rng.Intn(4)])
				movement.Passenger = rng.Intn(4) != 0
				update.Upserts = append(update.Upserts, movement)
				// Exercise removal/reinsertion and repeated upserts in the same message.
				if rng.Intn(3) == 0 {
					update.Removals = append(update.Removals, movement.ID)
				}
				if rng.Intn(3) == 0 {
					movement.Platform.Number = ptr("2")
					update.Upserts = append(update.Upserts, movement)
				}
			}
			message = update
		}
		state = Reduce(previous, message)
		for _, platforms := range [][]string{nil, {"2"}, {"2", "5"}, {"A"}, {"a", "2", "a"}} {
			want := fullPlatformAlterations(previous, state, platforms)
			got := deltaPlatformAlterations(previous, state, platforms, message)
			if !slices.Equal(got, want) {
				t.Fatalf("step %d, platforms %v: got %v, want %v", step, platforms, got, want)
			}
		}
	}
	invalid := &Update{Epoch: "wrong", PreviousRevision: state.Revision, Upserts: []Movement{prototype}}
	if got := deltaPlatformAlterations(state, Reduce(state, invalid), []string{"2"}, invalid); len(got) != 0 {
		t.Fatal(got)
	}
}

// Full comparison used as a reference for incremental-update tests.
func fullPlatformAlterations(previous, next *State, platforms []string) []string {
	selected := selectedPlatforms(platforms)
	if previous == nil || next == nil || selected == nil {
		return nil
	}
	var altered []string
	for id, movement := range next.Movements {
		before, seen := previous.Movements[id]
		if !seen {
			continue
		}
		was, now := platformNumber(before), platformNumber(movement)
		if was == "" || now == "" || was == now || !isPassengerCall(movement) {
			continue
		}
		if selected[was] != selected[now] {
			altered = append(altered, id)
		}
	}
	slices.Sort(altered)
	return altered
}
