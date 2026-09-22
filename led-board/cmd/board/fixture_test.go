package main

import (
	"context"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func record(t *testing.T, name string, run time.Duration) []model.View {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), run)
	defer cancel()
	var views []model.View
	done := make(chan struct{})
	go func() {
		playFixture(ctx, fixtures.Steps(name), 20*time.Millisecond, 50*time.Millisecond, func(v model.View) { views = append(views, v) })
		close(done)
	}()
	<-done
	return views
}

func TestFixtureRepeatsItsChange(t *testing.T) {
	// Two cycles take 2 × 20 ms for the step and 50 ms between them.
	views := record(t, "first-departs", 120*time.Millisecond)
	if len(views) != 4 {
		t.Fatalf("%d views, want the fixture's two views twice", len(views))
	}
	for i, v := range views {
		want := []string{"victoria", "bedford"}[i%2]
		if v.Services[0].ID != want {
			t.Errorf("view %d shows %q first, want %q", i, v.Services[0].ID, want)
		}
	}
}

func TestSingleViewFixtureIsShownOnce(t *testing.T) {
	if views := record(t, "busy-board", 120*time.Millisecond); len(views) != 1 {
		t.Fatalf("%d views, want 1", len(views))
	}
}
