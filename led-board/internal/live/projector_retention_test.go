package live

import (
	"encoding/json"
	"math/rand/v2"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Cached observations must match pure projection across policy and time changes.
func TestProjectorPoliciesAndRetainedViews(t *testing.T) {
	state, _ := projectionFixture(t)
	epoch := state.Window.From
	rng := rand.New(rand.NewPCG(18493, 29374))
	var p projector
	var retained []model.View
	var encoded [][]byte
	limits := []int{0, 1, 3, 6, 32, 64, 65}
	for step := range 500 {
		now := epoch.Add(time.Duration(rng.IntN(90)-20) * time.Second)
		opts := Options{MaxServices: limits[rng.IntN(len(limits))], ShowUnconfirmed: rng.IntN(2) == 0, LegacyTOCNames: rng.IntN(2) == 0}
		switch rng.IntN(4) {
		case 1:
			opts.Platforms = []string{"2"}
		case 2:
			opts.Platforms = []string{"2", "9"}
		case 3:
			opts.Platforms = []string{"missing"}
		}
		order := append([]string(nil), state.Ordering...)
		rng.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
		m := *state.Movements[order[rng.IntN(len(order))]]
		m.Cancelled = rng.IntN(2) == 0
		m.Platform.Number = ptr(strconv.Itoa(rng.IntN(4)))
		m.Platform.Suppressed = ptr(rng.IntN(5) == 0)
		m.Arrival.Actual = ptr(epoch.Add(time.Duration(rng.IntN(90)-20) * time.Second))
		update := &Update{Epoch: state.Epoch, PreviousRevision: state.Revision, Revision: state.Revision + 1, Ordering: order, Upserts: []Movement{m}}
		if step%7 == 0 {
			update.OverrideUpserts = []PlatformOverride{{ID: "warning", Kind: StandClear, Platform: "2", ActivatesAt: now.Add(-time.Second), ExpiresAt: now.Add(5 * time.Second)}}
		}
		state = Reduce(state, update)
		if step%31 == 0 {
			p.invalidate()
		}
		got, _ := p.display(state, opts, now)
		want := Display(state, opts, now)
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("step %d opts=%+v: projection differs", step, opts)
		}
		// Repeating the same observation must preserve bytes and ownership.
		repeated, _ := p.display(state, opts, now)
		if !reflect.DeepEqual(repeated, want) {
			t.Fatalf("step %d: repeat differs", step)
		}
		for i, old := range retained {
			data, err := json.Marshal(old)
			if err != nil || string(data) != string(encoded[i]) {
				t.Fatalf("step %d: prior view %d mutated", step, i)
			}
		}
		data, err := json.Marshal(got)
		if err != nil {
			t.Fatal(err)
		}
		if len(retained) == 16 {
			retained = retained[1:]
			encoded = encoded[1:]
		}
		retained = append(retained, got)
		encoded = append(encoded, data)
	}
}
