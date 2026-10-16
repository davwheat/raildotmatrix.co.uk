package testpattern

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestReadAndShowing(t *testing.T) {
	path := Path(filepath.Join(t.TempDir(), "network.json"))
	now := time.Now()
	if r := Read(path); r.Showing(now) {
		t.Fatal("a missing file requested a pattern")
	}
	os.WriteFile(path, []byte(`{"pattern":"green","until":"`+now.Add(time.Minute).Format(time.RFC3339Nano)+`"}`), 0644)
	r := Read(path)
	if !r.Showing(now) || r.Pattern != "green" {
		t.Fatalf("Read = %+v", r)
	}
	if r.Showing(now.Add(2 * time.Minute)) {
		t.Fatal("an expired request still shows")
	}
	if (Request{Pattern: "purple", Until: now.Add(time.Minute)}).Showing(now) {
		t.Fatal("an unknown pattern shows")
	}
}

func TestColoursAreSeparate(t *testing.T) {
	f := frame.New(256, 64)
	Draw(f, "colours", 128, 64)
	for x, want := range map[int]frame.RGB{0: red, 100: green, 200: blue} {
		lit := f.At(x, 0)
		if lit == frame.Black {
			lit = f.At(x+1, 0)
		}
		if lit != want {
			t.Errorf("column %d is %+v, want %+v", x, lit, want)
		}
	}
	Draw(f, "red", 128, 64)
	for y := range f.H {
		for x := range f.W {
			if c := f.At(x, y); c != red && c != frame.Black {
				t.Fatalf("red pattern lit (%d, %d) %+v", x, y, c)
			}
		}
	}
}

func TestLayoutOutlinesEachPanel(t *testing.T) {
	f := frame.New(256, 64)
	Draw(f, "layout", 128, 64)
	for _, p := range [][2]int{{0, 0}, {127, 63}, {128, 0}, {255, 63}, {127, 30}, {128, 30}} {
		if f.At(p[0], p[1]) != white {
			t.Errorf("outline missing at %v", p)
		}
	}
	if f.At(64, 4) != frame.Black {
		t.Error("panel interior is lit away from its label")
	}
}
