package daktronics

import (
	"fmt"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func serviceCountView() model.View {
	v := fixtures.Steps("busy-board")[0]
	base := v.Services[0]
	v.Services = nil
	for i := range 7 {
		s := base
		s.ID = fmt.Sprint(i)
		s.Destinations = []model.Location{{Name: fmt.Sprintf("Train %d", i+1)}}
		v.Services = append(v.Services, s)
	}
	return v
}

func TestServiceCountNormalization(t *testing.T) {
	for _, tc := range []struct{ configured, want int }{{0, 3}, {-1, 1}, {1, 1}, {2, 2}, {3, 3}, {4, 4}, {5, 5}, {6, 6}, {7, 6}} {
		b := New(Config{Width: testW, Height: testH, ServiceCount: tc.configured})
		if got := board.ServiceLimit(b); got != tc.want {
			t.Errorf("configured %d: service limit %d, want %d", tc.configured, got, tc.want)
		}
	}
}

func TestServiceRotationUpToSix(t *testing.T) {
	for _, size := range sizes {
		for _, worldline := range []bool{false, true} {
			for count := 1; count <= 6; count++ {
				t.Run(fmt.Sprintf("%dx%d/worldline=%v/count=%d", size[0], size[1], worldline, count), func(t *testing.T) {
					b := New(Config{Width: size[0], Height: size[1], ServiceCount: count, WorldlinePowered: worldline, OrdinalFormat: board.OrdinalDot})
					v := serviceCountView()
					b.Update(v)
					f := frame.New(size[0], size[1])
					b.Tick(fixtures.Clock, f)
					if got := len(b.content.rows); got != count {
						t.Fatalf("got %d services, want %d", got, count)
					}
					settled := fixtures.Clock.Add(slideInDuration * time.Millisecond)
					for step := 0; step < 2*count; step++ {
						now := settled.Add(time.Duration(step)*swapInterval*time.Millisecond + time.Second)
						b.Tick(now, f)
						if b.last.first.prefix != "1." || b.last.third.on != (count > 1) {
							t.Fatalf("step %d: first row %q, lower row shown %v", step, b.last.first.prefix, b.last.third.on)
						}
						if count > 1 {
							want := fmt.Sprintf("%d.", 2+step%(count-1))
							if b.last.third.prefix != want {
								t.Fatalf("step %d: got row %q, want %q", step, b.last.third.prefix, want)
							}
						}
					}
					// A large jump must select the correct service without catching up one tick at a time.
					b.Tick(settled.Add(101*swapInterval*time.Millisecond+time.Second), f)
					if count > 1 && b.last.third.prefix != fmt.Sprintf("%d.", 2+101%(count-1)) {
						t.Fatalf("wrong row after long pause: %q", b.last.third.prefix)
					}
					// Removing later services must reset the rotation index and clear their old pixels.
					v.Services = v.Services[:1]
					b.Update(v)
					b.Tick(settled.Add(time.Hour), f)
					if b.last.third.on {
						t.Fatal("lower row retained a removed service")
					}
					for y := b.geo.rowTop(2); y < b.geo.rowTop(3); y++ {
						for x := range f.W {
							if f.At(x, y) != frame.Black {
								t.Fatalf("removed service left a lit pixel at %d,%d", x, y)
							}
						}
					}
				})
			}
		}
	}
}

func TestDividingLowerServicesPageAndRotate(t *testing.T) {
	b := New(Config{Width: testW, Height: testH, ServiceCount: 6})
	v := serviceCountView()
	v.Services[1].Destinations = []model.Location{{Name: "First"}, {Name: "Second"}}
	v.Services[2].Destinations = []model.Location{{Name: "Third"}, {Name: "Fourth"}}
	b.Update(v)
	f := frame.New(testW, testH)
	b.Tick(fixtures.Clock, f)
	settled := fixtures.Clock.Add(slideInDuration * time.Millisecond)
	for _, tc := range []struct {
		at           time.Duration
		prefix, dest string
	}{
		{time.Second, "2nd", "First & "},
		{4 * time.Second, "2nd", "Second"},
		{13 * time.Second, "3rd", "Third & "},
		{16 * time.Second, "3rd", "Fourth"},
		{25 * time.Second, "4th", "Train 4"},
	} {
		b.Tick(settled.Add(tc.at), f)
		if b.last.third.prefix != tc.prefix || b.last.third.dest != tc.dest {
			t.Errorf("at %v: got %q %q, want %q %q", tc.at, b.last.third.prefix, b.last.third.dest, tc.prefix, tc.dest)
		}
	}
}
