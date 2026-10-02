package live

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// linkedFixture is a train from Winchester that ends at Southampton Central, where a bus links on to Bournemouth,
// where a train links on to Weymouth.
func linkedFixture(t *testing.T) *Snapshot {
	t.Helper()
	frame, err := os.ReadFile(filepath.Join("testdata", "fixtures", "linked_snapshot.pb"))
	if err != nil {
		t.Fatal(err)
	}
	message, err := Decode(frame)
	if err != nil {
		t.Fatal(err)
	}
	return message.(*Snapshot)
}

func advertisedService(t *testing.T, snapshot *Snapshot) (model.Location, []string) {
	t.Helper()
	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if len(service.Destinations) != 1 {
		t.Fatalf("destinations: got %+v", service.Destinations)
	}
	return service.Destinations[0], callNames(service.CallPoints)
}

func TestLinkedServicesAreShownAsOneServiceToTheLastDestination(t *testing.T) {
	destination, calls := advertisedService(t, linkedFixture(t))
	if want := (model.Location{Name: "Weymouth", CRS: "WEY"}); !reflect.DeepEqual(destination, want) {
		t.Fatalf("destination: got %+v, want %+v", destination, want)
	}
	want := []string{"Eastleigh", "Southampton Central", "Brockenhurst", "Bournemouth", "Poole", "Weymouth"}
	if !reflect.DeepEqual(calls, want) {
		t.Fatalf("calling points: got %v, want %v", calls, want)
	}
}

func TestLinkIsFollowedOnlyWhereTheServiceEndsAndWhileEachLinkedServiceRuns(t *testing.T) {
	own := []string{"Southampton Central", "Eastleigh", "Southampton Central"}
	toBournemouth := []string{"Bournemouth", "Eastleigh", "Southampton Central", "Brockenhurst", "Bournemouth"}
	toWeymouth := []string{"Weymouth", "Eastleigh", "Southampton Central", "Brockenhurst", "Bournemouth", "Poole", "Weymouth"}
	for _, tt := range []struct {
		name   string
		change func(bus *Portion, movement *Movement)
		want   []string
	}{
		{"a cancelled link", func(bus *Portion, _ *Movement) { bus.Cancelled = true }, own},
		{"a linked service the feed knows nothing about", func(bus *Portion, _ *Movement) { bus.Available = false }, own},
		{"the service these passengers came from", func(bus *Portion, _ *Movement) { bus.Main = ptr(false) }, own},
		{"a bus that runs nowhere", func(bus *Portion, _ *Movement) {
			for i := range bus.Calls[1:] {
				bus.Calls[i+1].Cancelled = true
			}
		}, own},
		{"a link at a call the train runs on past", func(bus *Portion, movement *Movement) {
			bus.At = movement.CallingPoints[0].Location
		}, own},
		{"a cancelled onward link", func(bus *Portion, _ *Movement) { bus.Links[0].Cancelled = true }, toBournemouth},
		{"an onward service the feed knows nothing about", func(bus *Portion, _ *Movement) { bus.Links[0].Available = false }, toBournemouth},
		{"a link that Darwin gave no direction", func(bus *Portion, _ *Movement) { bus.Main = nil }, toWeymouth},
		{"a false destination", func(_ *Portion, movement *Movement) {
			movement.FalseDestination = &movement.CallingPoints[0].Location
		}, []string{"Eastleigh", "Eastleigh"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			snapshot := linkedFixture(t)
			movement := &snapshot.Movements[0]
			tt.change(&movement.Portions[0], movement)
			destination, calls := advertisedService(t, snapshot)
			if got := append([]string{destination.Name}, calls...); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("destination and calling points: got %v, want %v", got, tt.want)
			}
			if destination.Via != "" {
				t.Fatalf("via: got %q", destination.Via)
			}
		})
	}
}

func TestTrainCutShortAtTheLinkHasItsCancelledCallsReplaced(t *testing.T) {
	snapshot := linkedFixture(t)
	movement := &snapshot.Movements[0]
	bus := &movement.Portions[0]
	bus.Links = nil
	// The train was booked through to Bournemouth, and the bus runs the part it no longer does.
	for _, call := range bus.Calls[1:] {
		call.ID, call.Cancelled = "own-"+call.ID, true
		movement.CallingPoints = append(movement.CallingPoints, call)
	}
	movement.Destinations = []Endpoint{{Location: bus.Calls[2].Location, Via: &Via{Text: "via Somewhere"}}}

	service := Display(Reduce(nil, snapshot), Options{}, snapshot.Window.From).Services[0]
	if want := []model.Location{{Name: "Bournemouth", CRS: "BMH"}}; !reflect.DeepEqual(service.Destinations, want) {
		t.Fatalf("destinations: got %+v, want %+v", service.Destinations, want)
	}
	want := []string{"Eastleigh", "Southampton Central", "Brockenhurst", "Bournemouth"}
	if got := callNames(service.CallPoints); !reflect.DeepEqual(got, want) {
		t.Fatalf("calling points: got %v, want %v", got, want)
	}
	for _, point := range service.CallPoints {
		if point.Cancelled {
			t.Fatalf("%s is listed as cancelled", point.Name)
		}
	}
}
