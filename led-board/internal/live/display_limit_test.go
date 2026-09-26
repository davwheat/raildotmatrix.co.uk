package live

import (
	"reflect"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestProjectedBoundariesKeepEveryVisibleChange(t *testing.T) {
	snapshot := snapshotFixture(t)
	prototype := snapshot.Movements[0]
	snapshot.Movements, snapshot.Ordering = nil, nil
	for i := range 12 {
		m := prototype
		m.ID = string(rune('a' + i))
		m.Platform.Number = ptr(string(rune('1' + i%3)))
		m.Platform.Suppressed = ptr(i%5 == 0)
		m.Suppressed = i%7 == 0
		m.Arrival.Actual = ptr(snapshot.Window.From.Add(time.Duration(i+1) * time.Second))
		snapshot.Movements = append(snapshot.Movements, m)
		snapshot.Ordering = append(snapshot.Ordering, m.ID)
	}
	snapshot.Overrides = []PlatformOverride{{
		ID: "warning", Platform: "3", Kind: StandClear,
		ActivatesAt: snapshot.Window.From.Add(2 * time.Second), ExpiresAt: snapshot.Window.From.Add(6 * time.Second),
	}}
	state := Reduce(nil, snapshot)
	for _, policy := range []Options{{}, {ShowUnconfirmed: true}, {Platforms: []string{"2"}}, {Platforms: []string{"1", "3"}, ShowUnconfirmed: true}, {Platforms: []string{"9"}}} {
		for _, limit := range []int{0, 1, 3, 6} {
			policy.MaxServices = limit
			var shown model.View
			var due time.Time
			for elapsed := time.Duration(0); elapsed <= 15*time.Second; elapsed += 25 * time.Millisecond {
				now := snapshot.Window.From.Add(elapsed)
				if elapsed == 0 || !due.IsZero() && !now.Before(due) {
					shown = Display(state, policy, now)
					due = nextBoundary(state, policy, now, shown.Services)
				}
				if want := Display(state, policy, now); !reflect.DeepEqual(shown, want) {
					t.Fatalf("policy %+v at %s skipped a visible change", policy, elapsed)
				}
			}
		}
	}
}

func TestDisplayLimitAfterFiltering(t *testing.T) {
	snapshot := snapshotFixture(t)
	prototype := snapshot.Movements[0]
	snapshot.Movements, snapshot.Ordering = nil, nil
	for i := range 12 {
		m := prototype
		m.ID = string(rune('a' + i))
		m.Platform.Number = ptr(string(rune('1' + i%3)))
		m.Platform.Suppressed = ptr(i%5 == 0)
		m.Suppressed = i%7 == 0
		snapshot.Movements = append(snapshot.Movements, m)
		snapshot.Ordering = append(snapshot.Ordering, m.ID)
	}
	snapshot.Overrides = []PlatformOverride{{
		ID: "warning", Platform: "3", Kind: StandClear,
		ActivatesAt: snapshot.Window.From, ExpiresAt: snapshot.Window.From.Add(time.Minute),
	}}
	state := Reduce(nil, snapshot)
	for _, now := range []time.Time{snapshot.Window.From, snapshot.Window.From.Add(time.Minute)} {
		for _, opts := range []Options{{}, {ShowUnconfirmed: true}, {Platforms: []string{"2"}}, {Platforms: []string{"1", "2"}, ShowUnconfirmed: true}} {
			full := Display(state, opts, now)
			if len(full.Services) < 2 {
				t.Fatal("test needs more matching services than the smallest limit")
			}
			for _, limit := range []int{-1, 1, 3, 6, 99} {
				opts.MaxServices = limit
				want := full
				if limit > 0 {
					want.Services = full.Services[:min(limit, len(full.Services))]
				}
				if got := Display(state, opts, now); !reflect.DeepEqual(got, want) {
					t.Fatalf("limit %d changed filtering, ordering, details or notice: got %v, want %v", limit, ids(got.Services), ids(want.Services))
				}
			}
		}
	}
}
