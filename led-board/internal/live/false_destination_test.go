package live

import (
	"reflect"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func callNames(points []model.CallPoint) []string {
	names := make([]string, len(points))
	for i, point := range points {
		names[i] = point.Name
	}
	return names
}

func TestFalseDestinationReplacesTheDestinationAndEndsTheCalls(t *testing.T) {
	initial := snapshotFixture(t)
	movement := &initial.Movements[0]
	junction := movement.CallingPoints[0]
	again := junction
	again.ID = "again"
	// A circular route: the train calls at the false destination twice on its way to the real one.
	movement.CallingPoints = []Call{junction, movement.CallingPoints[1], again}
	movement.Destinations = append(movement.Destinations, Endpoint{
		Location: Location{TPL: "PORTION", CRS: ptr("PTN"), Name: ptr("Portion destination")},
		AssocRID: ptr("R2"), AssocCat: ptr("VV"),
	})
	// The false destination names the station by another TIPLOC than the call does.
	movement.FalseDestination = &Location{TPL: "JUNCTN2", CRS: junction.CRS, Name: junction.Name}

	service := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[0]
	want := []model.Location{{Name: "Junction from feed", CRS: "JNC"}, {Name: "Portion destination", CRS: "PTN"}}
	if !reflect.DeepEqual(service.Destinations, want) {
		t.Fatalf("destinations: got %+v, want %+v", service.Destinations, want)
	}
	if got := callNames(service.CallPoints); !reflect.DeepEqual(got, []string{"Junction from feed"}) {
		t.Fatalf("calling points: got %v", got)
	}
}

func TestFalseDestinationTheTrainNeverCallsAtKeepsEveryCall(t *testing.T) {
	initial := snapshotFixture(t)
	movement := &initial.Movements[0]
	movement.FalseDestination = &Location{TPL: "ELSEWHERE", CRS: ptr("ELS"), Name: ptr("Elsewhere")}

	service := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[0]
	if got := service.Destinations; len(got) != 1 || got[0].Name != "Elsewhere" || got[0].Via != "" {
		t.Fatalf("destinations: got %+v", got)
	}
	if got := callNames(service.CallPoints); !reflect.DeepEqual(got, []string{"Junction from feed", "Destination from feed"}) {
		t.Fatalf("calling points: got %v", got)
	}
}
