package board

import (
	"reflect"
	"testing"
)

func TestPortionLabels(t *testing.T) {
	for _, tt := range []struct {
		name      string
		positions []string
		own       string
		portions  []string
	}{
		{"nothing says", []string{""}, "Front", []string{"Rear"}},
		{"nothing says of two portions", []string{"", ""}, "Front", []string{"Middle", "Rear"}},
		{"the portion is at the rear", []string{"rear"}, "Front", []string{"Rear"}},
		{"the portion is at the front", []string{"front"}, "Rear", []string{"Front"}},
		{"the portion is in the middle", []string{"middle"}, "Front", []string{"Middle"}},
		{"portions at both ends", []string{"front", "rear"}, "Middle", []string{"Front", "Rear"}},
		{"a portion at the rear and one that nothing places", []string{"rear", ""}, "Front", []string{"Rear", "Middle"}},
		{"a portion at the front and one that nothing places", []string{"front", ""}, "Rear", []string{"Front", "Middle"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			own, portions := PortionLabels(tt.positions)
			if own != tt.own || !reflect.DeepEqual(portions, tt.portions) {
				t.Fatalf("got %s and %v, want %s and %v", own, portions, tt.own, tt.portions)
			}
		})
	}
}
