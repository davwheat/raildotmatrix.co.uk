package formats

import (
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
)

func TestServiceCount(t *testing.T) {
	for _, format := range Names {
		for count := 0; count <= 6; count++ {
			b, err := New(format, Config{Width: 256, Height: 64, ServiceCount: count})
			if err != nil {
				t.Fatal(err)
			}
			want := count
			if want == 0 {
				want = 3
			}
			if got := board.ServiceLimit(b); got != want {
				t.Errorf("%s count %d: service limit %d, want %d", format, count, got, want)
			}
		}
		for _, count := range []int{-1, 7} {
			if _, err := New(format, Config{ServiceCount: count}); err == nil {
				t.Errorf("%s accepted service count %d", format, count)
			}
		}
	}
}
