package live

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/live/pb"
)

func TestNRCCMessagesReplaceOnEveryFrame(t *testing.T) {
	var state, initial *State
	for _, name := range []string{"nrcc_snapshot", "nrcc_update", "nrcc_clear"} {
		data, err := os.ReadFile(filepath.Join("testdata", "fixtures", name+".pb"))
		if err != nil {
			t.Fatal(err)
		}
		message, err := Decode(data)
		if err != nil {
			t.Fatal(err)
		}
		state = Reduce(state, message)
		if state == nil {
			t.Fatalf("%s invalidated the notice revision chain", name)
		}
		switch name {
		case "nrcc_snapshot":
			initial = state
			if len(state.NRCCMessages) != 1 || state.NRCCMessages[0].Suppress {
				t.Fatalf("snapshot notices: %+v", state.NRCCMessages)
			}
		case "nrcc_update":
			if len(state.NRCCMessages) != 1 || !state.NRCCMessages[0].Suppress || state.NRCCMessages[0].Text != "The station is closed." {
				t.Fatalf("updated notices: %+v", state.NRCCMessages)
			}
			if initial.NRCCMessages[0].Suppress || initial.NRCCMessages[0].Text == state.NRCCMessages[0].Text {
				t.Fatal("update mutated the previous state")
			}
			if got := Reduce(state, snapshotFixture(t)); len(got.NRCCMessages) != 0 {
				t.Fatal("authoritative snapshot retained stale notices")
			}
		case "nrcc_clear":
			if len(state.NRCCMessages) != 0 {
				t.Fatal("empty repeated field did not clear notices")
			}
		}
	}
}

func TestCoachFacilitiesPreservePresence(t *testing.T) {
	for _, facility := range []*bool{nil, ptr(true), ptr(false)} {
		wire := &pb.ServerMessage{Version: ProtocolVersion, Payload: &pb.ServerMessage_Snapshot{Snapshot: &pb.CisSnapshot{
			Movements: []*pb.Movement{{Coaches: &pb.CoachList{Coaches: []*pb.Coach{{Number: "A", Accessible: facility, CycleSpaces: facility, Food: facility}}}}},
		}}}
		data, err := wire.MarshalVT()
		if err != nil {
			t.Fatal(err)
		}
		message, err := Decode(data)
		if err != nil {
			t.Fatal(err)
		}
		got := message.(*Snapshot).Movements[0].Coaches[0]
		if !reflect.DeepEqual(got.Accessible, facility) || !reflect.DeepEqual(got.CycleSpaces, facility) || !reflect.DeepEqual(got.Food, facility) {
			t.Fatalf("facility presence changed: %+v", got)
		}
		if display := formationCoaches([]Coach{got})[0]; display.Food != (facility != nil && *facility) {
			t.Fatalf("food facility mapping: %+v", display)
		}
	}
}

func TestNRCCMessagesPreserveFutureCodesAndMarkup(t *testing.T) {
	const text = `<p>Notice &amp; details</p><a href="https://example.com">More</a>`
	got := nrccMessages([]*pb.NrccMessage{{Id: "notice", Text: text, Category: "Future", Severity: "99"}})
	if len(got) != 1 || got[0].Text != text || got[0].Category != "Future" || got[0].Severity != "99" {
		t.Fatalf("notice fields were changed or dropped: %+v", got)
	}
}

func TestFormationToiletLocations(t *testing.T) {
	for _, tt := range []struct {
		name       string
		toiletType *string
		toilet     bool
		accessible bool
	}{
		{name: "absent"},
		{name: "empty", toiletType: ptr("")},
		{name: "none", toiletType: ptr("None")},
		{name: "unknown", toiletType: ptr("Unknown")},
		{name: "standard", toiletType: ptr("Standard"), toilet: true},
		{name: "accessible", toiletType: ptr("Accessible"), toilet: true, accessible: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			for _, status := range []*string{nil, ptr("InService"), ptr("NotInService"), ptr("Unknown")} {
				got := formationCoaches([]Coach{{ToiletType: tt.toiletType, ToiletStatus: status}})[0]
				if got.Toilet != tt.toilet || got.Accessible != tt.accessible {
					t.Fatalf("toilet location mapping: %+v", got)
				}
			}
		})
	}
}
