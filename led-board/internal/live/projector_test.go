package live

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func projectionFixture(t testing.TB) (*State, *State) {
	t.Helper()
	raw, err := os.ReadFile("testdata/snapshot.json")
	if err != nil {
		t.Fatal(err)
	}
	var snapshot Snapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	prototype := snapshot.Movements[0]
	snapshot.Movements, snapshot.Ordering, snapshot.Overrides = nil, nil, nil
	for i := range 50 {
		movement := prototype
		movement.ID = fmt.Sprint("train-", i)
		movement.Arrival.Actual = ptr(snapshot.Window.From.Add(time.Duration(i+1) * time.Second))
		snapshot.Movements = append(snapshot.Movements, movement)
		snapshot.Ordering = append(snapshot.Ordering, movement.ID)
	}
	first := Reduce(nil, &snapshot)
	// A fresh authoritative snapshot owns new movement structs even when all
	// their values happen to match. It must never hit an old identity cache.
	snapshot.Movements = append([]Movement(nil), snapshot.Movements...)
	return first, Reduce(nil, &snapshot)
}

func TestProjectorMatchesPureProjectionAndRetainsOldViews(t *testing.T) {
	base, replacement := projectionFixture(t)
	for _, limit := range []int{0, 1, 3, 6, 100} {
		var p projector
		state := base
		opts := Options{MaxServices: limit}
		var retained []model.View
		var encoded [][]byte
		for step := range 12 {
			now := base.Window.From.Add(time.Duration(step) * time.Second)
			switch step {
			case 2:
				m := *state.Movements[state.Ordering[49]]
				m.CoachCount = ptr(int32(12))
				state = Reduce(state, &Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: state.Ordering, Upserts: []Movement{m}})
			case 3:
				m := *state.Movements[state.Ordering[0]]
				m.Cancelled = true
				m.Coaches = []Coach{{Number: "A", Food: ptr(true)}}
				state = Reduce(state, &Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: state.Ordering, Upserts: []Movement{m}})
			case 4:
				order := append([]string(nil), state.Ordering...)
				order[0], order[3] = order[3], order[0]
				state = Reduce(state, &Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: order})
			case 5:
				state = Reduce(state, &Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: state.Ordering, OverrideUpserts: []PlatformOverride{{ID: "warning", Kind: StandClear, Platform: "2", ActivatesAt: now, ExpiresAt: now.Add(time.Second)}}})
			case 7:
				opts.LegacyTOCNames = true
			case 8:
				now = base.Window.From.Add(-time.Second)
			case 9:
				state = replacement
				p.invalidate()
			case 10:
				opts.Platforms = []string{"9"}
			case 11:
				p = projector{}
				opts.Platforms = nil
			}
			got, _ := p.display(state, opts, now)
			want := Display(state, opts, now)
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("limit %d step %d changed the view", limit, step)
			}
			for i, previous := range retained {
				data, err := json.Marshal(previous)
				if err != nil || string(data) != string(encoded[i]) {
					t.Fatalf("limit %d step %d mutated prior view %d", limit, step, i)
				}
			}
			data, err := json.Marshal(got)
			if err != nil {
				t.Fatal(err)
			}
			retained, encoded = append(retained, got), append(encoded, data)
		}
	}
}

func TestPublishSkipsHiddenUpdatesButPreservesAlterationPulses(t *testing.T) {
	state, _ := projectionFixture(t)
	var views []model.View
	b := &board{state: state, opts: Options{MaxServices: 3}, boundary: time.NewTimer(time.Hour), log: slog.New(slog.DiscardHandler), emit: func(v model.View) { views = append(views, v) }}
	defer b.boundary.Stop()
	b.publish(nil)
	b.publish(nil)
	if len(views) != 1 {
		t.Fatal("unchanged projection woke the renderer")
	}
	m := *state.Movements[state.Ordering[49]]
	m.Cancelled = true
	b.apply(&Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: state.Ordering, Upserts: []Movement{m}})
	if len(views) != 1 || b.state.Revision != state.Revision+1 {
		t.Fatal("hidden update must advance protocol state without publishing")
	}
	b.publish([]string{m.ID})
	b.publish(nil)
	b.publish(nil)
	if len(views) != 3 || len(views[1].Alterations) != 1 || len(views[2].Alterations) != 0 {
		t.Fatal("alteration pulse or clearing was lost")
	}
	b.reset()
	if len(views) != 4 || views[3].Connected {
		t.Fatal("disconnect was lost")
	}
	b.state = state
	b.publish(nil)
	if len(views) != 5 || !views[4].Connected {
		t.Fatal("reconnect was suppressed")
	}
}

func TestProjectorSignalsArrivalAndClockRollback(t *testing.T) {
	state, _ := projectionFixture(t)
	var p projector
	for _, step := range []struct {
		seconds int
		changed bool
	}{{0, true}, {0, false}, {1, true}, {1, false}, {0, true}} {
		_, changed := p.display(state, Options{MaxServices: 3}, state.Window.From.Add(time.Duration(step.seconds)*time.Second))
		if changed != step.changed {
			t.Fatalf("at %d seconds changed=%v, want %v", step.seconds, changed, step.changed)
		}
	}
}

func TestSuppressedPublicationStillArmsFutureWarning(t *testing.T) {
	state, _ := projectionFixture(t)
	var views []model.View
	b := &board{state: state, opts: Options{MaxServices: 3}, boundary: time.NewTimer(time.Hour), log: slog.New(slog.DiscardHandler), emit: func(v model.View) { views = append(views, v) }}
	defer b.boundary.Stop()
	b.publish(nil)
	now := time.Now()
	b.apply(&Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: state.Ordering, OverrideUpserts: []PlatformOverride{{ID: "upcoming", Kind: StandClear, Platform: "2", ActivatesAt: now.Add(50 * time.Millisecond), ExpiresAt: now.Add(time.Hour)}}})
	if len(views) != 1 {
		t.Fatal("future warning changed the current view")
	}
	select {
	case <-b.boundary.C:
	case <-time.After(2 * time.Second):
		t.Fatal("suppressing an unchanged view lost its next deadline")
	}
	b.publish(nil)
	if len(views) != 2 || views[1].Notice != model.StandClear {
		t.Fatal("scheduled warning was not published")
	}
}
