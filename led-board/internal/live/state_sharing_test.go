package live

import (
	"encoding/json"
	"testing"
)

func TestMetadataUpdatesPreservePreviousStates(t *testing.T) {
	initial := Reduce(nil, snapshotFixture(t))
	initial.Overrides["warning"] = &PlatformOverride{ID: "warning", Platform: "1"}
	previous := initial
	var states []*State
	var expected []string
	for step := range 8 {
		encoded, err := json.Marshal(previous)
		if err != nil {
			t.Fatal(err)
		}
		states = append(states, previous)
		expected = append(expected, string(encoded))
		update := &Update{Epoch: previous.Epoch, PreviousRevision: previous.Revision, Revision: previous.Revision + 1, Ordering: previous.Ordering}
		switch step {
		case 0, 2, 4, 6:
			update.NRCCMessages = []NRCCMessage{{Text: "A new station notice"}}
		case 1:
			update.Upserts = []Movement{{ID: previous.Ordering[0], Platform: Platform{Number: ptr("3")}}}
		case 3:
			update.OverrideUpserts = []PlatformOverride{{ID: "warning", Platform: "2"}}
		case 5:
			update.Removals = previous.Ordering
			update.Ordering = []string{}
		case 7:
			update.OverrideRemovals = []OverrideRemoval{{ID: "warning"}}
		}
		previous = Reduce(previous, update)
		if previous == nil {
			t.Fatal("valid revision chain was rejected")
		}
		for i, state := range states {
			encoded, err := json.Marshal(state)
			if err != nil || string(encoded) != expected[i] {
				t.Fatalf("step %d mutated previous state %d", step, i)
			}
		}
	}
	if len(previous.Movements) != 0 || len(previous.Overrides) != 0 {
		t.Fatal("removals did not clear the final state")
	}
}
