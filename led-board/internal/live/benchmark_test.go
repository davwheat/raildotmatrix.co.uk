package live

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func BenchmarkDisplay(b *testing.B) {
	raw, err := os.ReadFile("testdata/snapshot.json")
	if err != nil {
		b.Fatal(err)
	}
	var snapshot Snapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		b.Fatal(err)
	}
	// A busy station with 50 trains, each carrying the fixture's calling points and portion details.
	prototype := snapshot.Movements[0]
	snapshot.Movements, snapshot.Ordering, snapshot.Overrides = nil, nil, nil
	for i := range 50 {
		m := prototype
		m.ID = fmt.Sprintf("train-%d", i)
		snapshot.Movements = append(snapshot.Movements, m)
		snapshot.Ordering = append(snapshot.Ordering, m.ID)
	}
	state := Reduce(nil, &snapshot)
	for _, limit := range []int{0, 3, 6} {
		b.Run(fmt.Sprintf("limit-%d", limit), func(b *testing.B) {
			opts := Options{MaxServices: limit}
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				Display(state, opts, snapshot.Window.From)
			}
		})
	}
}
