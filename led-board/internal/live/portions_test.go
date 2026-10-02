package live

import (
	"reflect"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func namedCall(id, tpl, crs, name string) Call {
	return Call{ID: id, Location: Location{TPL: tpl, CRS: ptr(crs), Name: ptr(name)}}
}

// joiningFixture is the fixture's train as a portion that joins another one at its destination. The train it
// joins has come from elsewhere and runs on to a terminus of its own.
func joiningFixture(t *testing.T) (*Snapshot, *Movement, *Portion) {
	t.Helper()
	snapshot := snapshotFixture(t)
	movement := &snapshot.Movements[0]
	join := movement.CallingPoints[1]
	movement.Portions = []Portion{{
		RID: "MAIN", Category: "JJ", At: join.Location, Available: true, Main: ptr(false),
		Destination: &Location{TPL: "THROUGH", CRS: ptr("THR"), Name: ptr("Through terminus")},
		Calls: []Call{
			namedCall("m0", "ELSEWHERE", "ELS", "Elsewhere"),
			namedCall("m1", join.TPL, "DST", "Destination from feed"),
			namedCall("m2", "AFTER", "AFT", "After the join"),
			namedCall("m3", "THROUGH", "THR", "Through terminus"),
		},
	}}
	return snapshot, movement, &movement.Portions[0]
}

func shown(t *testing.T, snapshot *Snapshot) []string {
	t.Helper()
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	names := make([]string, len(service.Destinations))
	for i, destination := range service.Destinations {
		names[i] = destination.Name
		if destination.Via != "" {
			names[i] += " " + destination.Via
		}
	}
	return append(append(names, "|"), callNames(service.CallPoints)...)
}

func TestJoiningPortionIsShownAsAThroughServiceOfTheTrainItJoins(t *testing.T) {
	own := []string{"Destination from feed via Junction", "|", "Junction from feed", "Destination from feed"}
	through := []string{"Through terminus", "|", "Junction from feed", "Destination from feed", "After the join", "Through terminus"}
	for _, tt := range []struct {
		name   string
		change func(movement *Movement, main *Portion)
		want   []string
	}{
		{"a portion that joins", func(*Movement, *Portion) {}, through},
		{"a join that Darwin gave no direction", func(_ *Movement, main *Portion) { main.Main = nil }, through},
		{"a join at a call that passengers can't use", func(movement *Movement, _ *Portion) {
			movement.CallingPoints[1].Operational = true
		}, []string{"Through terminus", "|", "Junction from feed", "After the join", "Through terminus"}},
		{"the train that is joined", func(_ *Movement, main *Portion) { main.Main = ptr(true) }, own},
		{"a cancelled join", func(_ *Movement, main *Portion) { main.Cancelled = true }, own},
		{"a train the feed knows nothing about", func(_ *Movement, main *Portion) { main.Available = false }, own},
		{"a join at a call the train runs on past", func(movement *Movement, main *Portion) {
			main.At = movement.CallingPoints[0].Location
		}, own},
		{"a train that runs nowhere from the join", func(_ *Movement, main *Portion) {
			main.Calls[2].Cancelled, main.Calls[3].Cancelled = true, true
		}, own},
	} {
		t.Run(tt.name, func(t *testing.T) {
			snapshot, movement, main := joiningFixture(t)
			tt.change(movement, main)
			if got := shown(t, snapshot); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("destination and calling points: got %v, want %v", got, tt.want)
			}
		})
	}
}

func dividingFixture(t *testing.T) (*Snapshot, *Movement, *Portion) {
	t.Helper()
	snapshot := snapshotFixture(t)
	movement := &snapshot.Movements[0]
	divide := movement.CallingPoints[0]
	movement.Destinations = append(movement.Destinations, Endpoint{
		Location: Location{TPL: "BRANCH", CRS: ptr("BRN"), Name: ptr("Branch terminus")}, AssocRID: ptr("PORTION"), AssocCat: ptr("VV"),
	})
	movement.Portions = []Portion{{
		RID: "PORTION", Category: "VV", At: divide.Location, Available: true, Main: ptr(true), CoachCount: ptr(int32(4)),
		Calls: []Call{
			namedCall("p0", divide.TPL, "JNC", "Junction from feed"),
			namedCall("p1", "HALT", "HLT", "Branch halt"),
			namedCall("p2", "BRANCH", "BRN", "Branch terminus"),
		},
	}}
	return snapshot, movement, &movement.Portions[0]
}

func TestDivisionAtACallNobodyCanUseIsStillListed(t *testing.T) {
	snapshot, movement, portion := dividingFixture(t)
	movement.CallingPoints[0].Operational = true
	portion.Calls[0].Operational = true

	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if got, want := callNames(service.CallPoints), []string{"Junction from feed", "Destination from feed"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("calling points: got %v, want %v", got, want)
	}
	divides := service.CallPoints[0].Divides
	if len(divides) != 1 || divides[0].Length != 4 {
		t.Fatalf("divides: got %+v", divides)
	}
	if got, want := callNames(divides[0].CallPoints), []string{"Branch halt", "Branch terminus"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("the portion's calling points: got %v, want %v", got, want)
	}

	portion.Cancelled = true
	if got, want := callNames(Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0].CallPoints), []string{"Destination from feed"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("a call kept only for a division that no longer happens: got %v, want %v", got, want)
	}
}

func TestPortionThatNoLongerRunsIsNoDestination(t *testing.T) {
	own := []model.Location{{Name: "Destination from feed", CRS: "DST", Via: "via Junction"}}
	for _, tt := range []struct {
		name   string
		change func(movement *Movement, portion *Portion)
	}{
		{"a portion whose calls are all cancelled", func(_ *Movement, portion *Portion) {
			portion.Calls[1].Cancelled, portion.Calls[2].Cancelled = true, true
		}},
		{"a cancelled division", func(_ *Movement, portion *Portion) { portion.Cancelled = true }},
		{"a portion the feed knows nothing about", func(movement *Movement, portion *Portion) {
			// The feed describes it by no station at all.
			portion.Available, portion.Calls = false, nil
			movement.Destinations[1].Location = Location{}
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			snapshot, movement, portion := dividingFixture(t)
			tt.change(movement, portion)
			service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
			if !reflect.DeepEqual(service.Destinations, own) {
				t.Fatalf("destinations: got %+v, want %+v", service.Destinations, own)
			}
			if divides := service.CallPoints[0].Divides; len(divides) != 0 {
				t.Fatalf("divides: got %+v", divides)
			}
		})
	}

	snapshot, _, _ := dividingFixture(t)
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if len(service.Destinations) != 2 || service.Destinations[1].Name != "Branch terminus" || len(service.CallPoints[0].Divides) != 1 {
		t.Fatalf("a portion that runs: destinations %+v, divides %+v", service.Destinations, service.CallPoints[0].Divides)
	}
}

func TestEndpointThatNamesNowhereIsLeftOut(t *testing.T) {
	snapshot := snapshotFixture(t)
	movement := &snapshot.Movements[0]
	movement.Origins = append(movement.Origins, Endpoint{AssocRID: ptr("JOINER"), AssocCat: ptr("JJ")})
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if len(service.Origins) != 1 || service.Origins[0].Name != "Origin from feed" {
		t.Fatalf("origins: got %+v", service.Origins)
	}
}

func TestPortionIsPlacedAtTheEndTheFeedGivesAsTheTrainStandsHere(t *testing.T) {
	position := func(change func(movement *Movement, portion *Portion)) string {
		snapshot, movement, portion := dividingFixture(t)
		change(movement, portion)
		service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
		return service.CallPoints[0].Divides[0].Position
	}
	for _, tt := range []struct {
		name   string
		change func(movement *Movement, portion *Portion)
		want   string
	}{
		{"the feed says", func(_ *Movement, portion *Portion) { portion.Position = ptr("front") }, "front"},
		{"the feed outranks Darwin's default", func(movement *Movement, portion *Portion) {
			movement.CallingPoints[0].DetachFront, portion.Position = ptr(false), ptr("front")
		}, "front"},
		{"only Darwin says", func(movement *Movement, _ *Portion) { movement.CallingPoints[0].DetachFront = ptr(true) }, "front"},
		{"Darwin's default", func(movement *Movement, _ *Portion) { movement.CallingPoints[0].DetachFront = ptr(false) }, "rear"},
		{"nothing says", func(movement *Movement, _ *Portion) { movement.CallingPoints[0].DetachFront = nil }, ""},
		{"a position the board has no name for", func(movement *Movement, portion *Portion) {
			movement.CallingPoints[0].DetachFront, portion.Position = nil, ptr("sideways")
		}, ""},
		{"a reversal at the division itself", func(movement *Movement, portion *Portion) {
			movement.CallingPoints[0].Activities, portion.Position = ptr("T RM"), ptr("front")
		}, "front"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := position(tt.change); got != tt.want {
				t.Fatalf("position: got %q, want %q", got, tt.want)
			}
		})
	}

	// The feed names the end as the train arrives at the division. A reversal on the way there swaps the ends.
	snapshot, movement, portion := dividingFixture(t)
	turn := namedCall("turn", "TURN", "TRN", "Turning point")
	turn.Activities = ptr("T RM")
	movement.CallingPoints = append([]Call{turn}, movement.CallingPoints...)
	portion.Position = ptr("front")
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if got := service.CallPoints[1].Divides[0].Position; got != "rear" {
		t.Fatalf("position after a reversal on the way: got %q, want the other end", got)
	}
}

func TestCoachesLeftBehindAreListedAsAPortionThatGoesNoFurther(t *testing.T) {
	snapshot := snapshotFixture(t)
	movement := &snapshot.Movements[0]
	movement.CallingPoints[0].FormationChange = &FormationChange{Detached: &FormationPart{Coaches: ptr(int32(4)), Position: ptr("front")}}
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	want := []model.Portion{{Length: 4, Position: "front"}}
	if got := service.CallPoints[0].Divides; !reflect.DeepEqual(got, want) {
		t.Fatalf("divides: got %+v, want %+v", got, want)
	}
	if len(service.Destinations) != 1 {
		t.Fatalf("coaches that go no further are no destination: %+v", service.Destinations)
	}

	// Coaches that join change nothing a passenger chooses a coach by.
	movement.CallingPoints[0].FormationChange = &FormationChange{Attached: &FormationPart{Coaches: ptr(int32(4))}}
	if got := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0].CallPoints[0].Divides; len(got) != 0 {
		t.Fatalf("coaches that join: got %+v", got)
	}

	// A portion that divides off there is what leaves, and the feed doesn't say it twice.
	snapshot, movement, _ = dividingFixture(t)
	movement.CallingPoints[0].FormationChange = &FormationChange{Detached: &FormationPart{Coaches: ptr(int32(4)), Position: ptr("rear")}}
	if got := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0].CallPoints[0].Divides; len(got) != 1 || len(got[0].CallPoints) == 0 {
		t.Fatalf("a division and coaches left behind at one call: got %+v", got)
	}
}

func TestJoinedTrainsDivisionsAndLinksAreFollowed(t *testing.T) {
	snapshot, _, main := joiningFixture(t)
	after := main.Calls[2]
	main.Links = []Portion{
		{
			RID: "BRANCH", Category: "VV", At: after.Location, Available: true, Main: ptr(true), CoachCount: ptr(int32(4)), Position: ptr("rear"),
			Destination: &Location{TPL: "BRANCH", CRS: ptr("BRN"), Name: ptr("Branch terminus")},
			Calls:       []Call{namedCall("b0", after.TPL, "AFT", "After the join"), namedCall("b1", "BRANCH", "BRN", "Branch terminus")},
		},
		{
			RID: "BUS", Category: "LK", At: main.Calls[3].Location, Available: true, Main: ptr(true), Mode: ptr(ModeBus),
			Destination: &Location{TPL: "BEYOND", CRS: ptr("BYD"), Name: ptr("Beyond")},
			Calls:       []Call{namedCall("l0", "THROUGH", "THR", "Through terminus"), namedCall("l1", "BEYOND", "BYD", "Beyond")},
		},
	}
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if got, want := callNames(service.CallPoints), []string{"Junction from feed", "Destination from feed", "After the join", "Through terminus", "Beyond"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("calling points: got %v, want %v", got, want)
	}
	destinations := make([]string, len(service.Destinations))
	for i, destination := range service.Destinations {
		destinations[i] = destination.Name
	}
	if want := []string{"Beyond", "Branch terminus"}; !reflect.DeepEqual(destinations, want) {
		t.Fatalf("destinations: got %v, want %v", destinations, want)
	}
	divides := service.CallPoints[2].Divides
	if len(divides) != 1 || divides[0].Position != "rear" || !reflect.DeepEqual(callNames(divides[0].CallPoints), []string{"After the join", "Branch terminus"}) {
		t.Fatalf("the joined train's division: got %+v", divides)
	}
}
