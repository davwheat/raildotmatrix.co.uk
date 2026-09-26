package board

import (
	"testing"
	"time"
)

func TestNextScrollPixelMatchesMillisecondPositions(t *testing.T) {
	start := time.Unix(100, 123456)
	for _, speed := range []int{1, 48, 60, 77, 96, 120, 1000} {
		for elapsed := int64(0); elapsed < 2048; elapsed++ {
			now := start.Add(time.Duration(elapsed)*time.Millisecond + 999*time.Microsecond)
			position := elapsed * int64(speed) / 1000
			next := elapsed + 1
			for next*int64(speed)/1000 == position {
				next++
			}
			want := start.Add(time.Duration(next) * time.Millisecond)
			if got := NextScrollPixel(now, start, speed); !got.Equal(want) {
				t.Fatalf("speed=%d elapsed=%d: got %s, want %s", speed, elapsed, got, want)
			}
		}
	}
	if !NextScrollPixel(start.Add(-time.Millisecond), start, 60).IsZero() {
		t.Fatal("backwards clock must retain refresh pacing")
	}
}
