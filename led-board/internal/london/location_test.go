package london

import (
	"testing"
	"time"
)

func TestLondon(t *testing.T) {
	zone, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		utc, name string
		offset    int
	}{
		{"1942-06-01T12:00:00Z", "BDST", 7200},
		{"1970-01-01T00:00:00Z", "BST", 3600},
		{"2026-03-29T00:59:59Z", "GMT", 0},
		{"2026-03-29T01:00:00Z", "BST", 3600},
		{"2026-10-25T00:59:59Z", "BST", 3600},
		{"2026-10-25T01:00:00Z", "GMT", 0},
		{"2100-01-01T12:00:00Z", "GMT", 0},
		{"2100-07-01T12:00:00Z", "BST", 3600},
	} {
		t.Run(c.utc, func(t *testing.T) {
			instant, err := time.Parse(time.RFC3339, c.utc)
			if err != nil {
				t.Fatal(err)
			}
			name, offset := instant.In(zone).Zone()
			if name != c.name || offset != c.offset {
				t.Fatalf("got %s %d, want %s %d", name, offset, c.name, c.offset)
			}
		})
	}
}
