package daktronics

import (
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func TestDestinationFitsBesideETD(t *testing.T) {
	const gap = 1
	g := newGeometry(testW, testH, board.PrefixOrdinals)
	if got, want := g.destX+g.destWidth("1943")+gap+4*g.ch+etdPad, g.w; got != want {
		t.Errorf("a destination beside a time ends at %d, want %d", got, want)
	}
	if got, want := g.destX+g.destWidth("Arrived")+gap+font.Text.Width("Arrived")+etdPad, g.w; got != want {
		t.Errorf("a destination beside \"Arrived\" ends at %d, want %d", got, want)
	}
	for _, etd := range []string{"Delayed", "Cancelled"} {
		if got, want := g.destX+g.destWidth(etd)+gap+font.Text.Width(etd), g.w; got != want {
			t.Errorf("a destination beside %q ends at %d, want %d", etd, got, want)
		}
	}
	if g.destWidth("Cancelled") != g.destW {
		t.Errorf("a destination beside \"Cancelled\" has %d dots, want the column's %d", g.destWidth("Cancelled"), g.destW)
	}
}

func TestReservedETDColumn(t *testing.T) {
	b := New(Config{Width: testW, Height: testH, ReserveETDColumn: true})
	for _, etd := range []string{"Arrived", "Delayed", "Cancelled"} {
		if got := b.geo.destWidth(etd); got != b.geo.destW {
			t.Errorf("a destination beside %q has %d dots, want the reserved %d", etd, got, b.geo.destW)
		}
	}
	unreserved := newGeometry(testW, testH, board.PrefixOrdinals)
	if got, want := b.geo.destWidth("1943"), unreserved.destWidth("1943"); got != want {
		t.Errorf("a destination beside a time has %d dots, want the unreserved %d", got, want)
	}
}

func TestArrivedKeepsGapToEdge(t *testing.T) {
	// "Arrived" and "Cancelled" both end in "d", so only the gap can move their last lit column.
	cancelled := firstRowRightEdge(t, func(s *model.Service) { s.Cancelled = true })
	arrived := firstRowRightEdge(t, func(s *model.Service) { s.Arrived, s.StartsHere = true, false })
	if arrived != cancelled-etdPad {
		t.Errorf("\"Arrived\" ends at %d and \"Cancelled\" at %d, want %d dots apart", arrived, cancelled, etdPad)
	}
}

func firstRowRightEdge(t *testing.T, set func(*model.Service)) int {
	t.Helper()
	b := New(Config{Width: testW, Height: testH})
	v := fixtures.Steps("single-departure")[0]
	set(&v.Services[0])
	b.Update(v)
	f := frame.New(testW, testH)
	b.Tick(fixtures.Clock, f)
	b.Tick(fixtures.Clock.Add(5*time.Second), f)
	y := b.geo.textY(0)
	for x := testW - 1; x >= 0; x-- {
		for py := y; py < y+font.Text.Height; py++ {
			if f.At(x, py) != frame.Black {
				return x
			}
		}
	}
	t.Fatal("the first row is blank")
	return 0
}
