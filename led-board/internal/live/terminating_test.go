package live

import (
	"log/slog"
	"reflect"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestHideTerminatingBeforeServiceLimit(t *testing.T) {
	initial := snapshotFixture(t)
	departure := initial.Movements[0]
	terminating := departure
	terminating.ID = "terminating"
	terminating.Arrival = terminating.Departure
	terminating.Arrival.Actual = ptr(initial.Window.From.Add(30 * time.Second))
	terminating.Departure = Times{}
	terminating.Portions = nil
	cancelled := terminating
	cancelled.ID = "cancelled-terminating"
	cancelled.Cancelled = true
	initial.Movements = []Movement{terminating, cancelled, departure}
	initial.Ordering = []string{terminating.ID, cancelled.ID, departure.ID}
	state := Reduce(nil, initial)
	var projection projector
	for _, hide := range []bool{false, true, false} {
		opts := Options{HideTerminating: hide, MaxServices: 1}
		want := []string{terminating.ID}
		if hide {
			want = []string{departure.ID}
		}
		view := Display(state, opts, initial.Window.From)
		if got := ids(view.Services); !reflect.DeepEqual(got, want) {
			t.Fatalf("hide %v: got %v, want %v", hide, got, want)
		}
		cached, _ := projection.display(state, opts, initial.Window.From)
		if !reflect.DeepEqual(cached, view) {
			t.Fatal("cached projection differs from pure projection")
		}
	}
	opts := Options{HideTerminating: true}
	if got := Display(state, opts, initial.Window.From); !reflect.DeepEqual(ids(got.Services), []string{departure.ID}) {
		t.Fatal("filter did not exclude both normal and cancelled terminating trains")
	}
	if got := NextBoundary(state, opts, initial.Window.From); !got.IsZero() {
		t.Fatalf("hidden arrival scheduled a boundary at %v", got)
	}
	if got := Display(state, Options{HideTerminating: true, Platforms: []string{"3"}, ShowUnconfirmed: true}, initial.Window.From); len(got.Services) != 0 {
		t.Fatal("filter ignored the selected platforms")
	}
	state.Ordering = []string{terminating.ID, cancelled.ID}
	if got := Display(state, opts, initial.Window.From); !got.Connected || len(got.Services) != 0 {
		t.Fatal("expected a connected empty board")
	}
	state.Overrides["warning"] = &PlatformOverride{ID: "warning", Platform: "2", Kind: StandClear, ActivatesAt: initial.Window.From, ExpiresAt: initial.Window.To}
	if got := Display(state, opts, initial.Window.From); got.Notice != model.StandClear {
		t.Fatal("hiding terminating trains suppressed a platform warning")
	}
}

func TestHideTerminatingSuppressesTheirAlterations(t *testing.T) {
	initial := snapshotFixture(t)
	departure := initial.Movements[0]
	terminating := departure
	terminating.ID = "terminating"
	terminating.Arrival, terminating.Departure = terminating.Departure, Times{}
	terminating.Portions = nil
	initial.Movements = []Movement{terminating, departure}
	initial.Ordering = []string{terminating.ID, departure.ID}
	var views []model.View
	b := &board{
		state: Reduce(nil, initial), opts: Options{HideTerminating: true, MaxServices: 3},
		boundary: time.NewTimer(time.Hour), log: slog.New(slog.DiscardHandler),
		emit: func(v model.View) { views = append(views, v) },
	}
	defer b.boundary.Stop()
	b.publish(nil)
	b.publish([]string{terminating.ID})
	if len(views) != 1 {
		t.Fatal("hidden terminating train triggered an alteration")
	}
	b.publish([]string{terminating.ID, departure.ID})
	if len(views) != 2 || !reflect.DeepEqual(views[1].Alterations, []string{departure.ID}) {
		t.Fatal("departure alteration was lost")
	}
}
