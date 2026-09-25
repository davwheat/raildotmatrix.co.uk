package live

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"reflect"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestOwnedReducerParity(t *testing.T) {
	for _, platforms := range [][]string{nil, {"2"}, {"1", "3"}} {
		rng := rand.New(rand.NewSource(8813))
		var reference, owned *State
		var cached projector
		opts := Options{Platforms: platforms, MaxServices: 6}
		var retained []model.View
		var encoded [][]byte
		visibleViews, alterationsSeen, largeDeltas := 0, 0, 0
		now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
		for step := range 1200 {
			var message Message
			if reference == nil || step%37 == 0 {
				snapshot := snapshotFixture(t)
				snapshot.Epoch = fmt.Sprintf("epoch-%d", step)
				snapshot.Revision = 1
				prototype := snapshot.Movements[0]
				snapshot.Movements, snapshot.Ordering = nil, nil
				for i := range 50 {
					movement := prototype
					movement.ID = fmt.Sprintf("train-%d", i)
					movement.Platform.Number = ptr(fmt.Sprint(1 + i%4))
					snapshot.Movements = append(snapshot.Movements, movement)
					snapshot.Ordering = append(snapshot.Ordering, movement.ID)
				}
				message = snapshot
				cached.invalidate()
			} else {
				update := &Update{Epoch: reference.Epoch, PreviousRevision: reference.Revision, Revision: reference.Revision + 1, Window: reference.Window}
				for _, i := range rng.Perm(60) {
					update.Ordering = append(update.Ordering, fmt.Sprintf("train-%d", i))
				}
				for i := 0; i < rng.Intn(12); i++ {
					id := fmt.Sprintf("train-%d", rng.Intn(60))
					movement := Movement{ID: id, Passenger: rng.Intn(5) != 0, Kind: KindStop, Mode: ModeTrain, Platform: Platform{Number: ptr(fmt.Sprint(1 + rng.Intn(4)))}}
					if prior := reference.Movements[id]; prior != nil {
						movement = *prior
						movement.Platform.Number = ptr(fmt.Sprint(1 + rng.Intn(4)))
					}
					if rng.Intn(3) == 0 {
						movement.Arrival.Actual = ptr(now.Add(time.Duration(rng.Intn(60)-30) * time.Second))
					}
					update.Upserts = append(update.Upserts, movement)
					if rng.Intn(3) == 0 {
						update.Removals = append(update.Removals, id)
					}
					// Duplicate IDs must compare the final upsert against the original entity.
					if rng.Intn(3) == 0 {
						movement.Platform.Number = ptr(fmt.Sprint(1 + rng.Intn(4)))
						update.Upserts = append(update.Upserts, movement)
					}
				}
				if step%3 == 0 {
					update.Removals = append(update.Removals, fmt.Sprintf("train-%d", rng.Intn(60)))
				}
				if step%4 == 0 {
					update.OverrideUpserts = []PlatformOverride{{ID: "warning", Platform: "2", Kind: StandClear, ActivatesAt: now.Add(-time.Minute), ExpiresAt: now.Add(time.Minute)}}
				}
				if step%7 == 0 {
					update.OverrideRemovals = []OverrideRemoval{{ID: "warning"}}
				}
				if step%11 == 0 {
					update.NRCCMessages = []NRCCMessage{{Text: "Notice"}}
				}
				if step%43 == 0 {
					update.PreviousRevision++
				}
				if step%71 == 0 {
					update.Epoch = "wrong"
				}
				message = update
			}
			messageBefore, _ := json.Marshal(message)
			if update, ok := message.(*Update); ok && len(update.Upserts) > 8 {
				largeDeltas++
			}
			previous := reference
			reference = Reduce(reference, message)
			wantAlterations := deltaPlatformAlterations(previous, reference, platforms, message)
			var gotAlterations []string
			owned, gotAlterations = reduceOwned(owned, message, platforms)
			if !reflect.DeepEqual(reference, owned) || !reflect.DeepEqual(wantAlterations, gotAlterations) {
				t.Fatalf("step %d platforms %v: state or alterations diverged", step, platforms)
			}
			messageAfter, _ := json.Marshal(message)
			if string(messageBefore) != string(messageAfter) {
				t.Fatalf("step %d: input entity mutated", step)
			}
			var got, want model.View
			if owned != nil {
				got, _ = cached.display(owned, opts, now)
				want = Display(reference, opts, now)
				got.Alterations, want.Alterations = gotAlterations, wantAlterations
				if owned.Digest() != reference.Digest() {
					t.Fatal("attestation digest diverged")
				}
			} else {
				cached = projector{}
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("step %d: projected view diverged", step)
			}
			if len(got.Services) != 0 {
				visibleViews++
			}
			alterationsSeen += len(gotAlterations)
			for i, old := range retained {
				nowEncoded, _ := json.Marshal(old)
				if string(nowEncoded) != string(encoded[i]) {
					t.Fatalf("step %d: retained view %d mutated", step, i)
				}
			}
			data, _ := json.Marshal(got)
			retained, encoded = append(retained, got), append(encoded, data)
			if len(retained) > 16 {
				retained, encoded = retained[1:], encoded[1:]
			}
			now = now.Add(time.Second)
		}
		if visibleViews < 100 || largeDeltas == 0 || (len(platforms) != 0 && alterationsSeen == 0) {
			t.Fatalf("insufficient coverage: visible=%d alterations=%d large=%d", visibleViews, alterationsSeen, largeDeltas)
		}
	}
}
