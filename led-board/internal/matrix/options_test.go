package matrix

import (
	"flag"
	"io"
	"strings"
	"testing"
)

func TestAddFlagsDefaults(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	o := AddFlags(fs)
	if err := fs.Parse(nil); err != nil {
		t.Fatal(err)
	}
	want := Default()
	if *o != *want {
		t.Fatalf("defaults = %+v, want %+v", *o, *want)
	}
}

func TestAddFlagsOverrides(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	o := AddFlags(fs)
	args := []string{
		"-led-rows=32", "-led-chain=1", "-led-rgb-sequence=RGB",
		"-led-no-drop-privs", "-led-limit-refresh=100", "-led-show-refresh", "-led-no-busy-waiting",
	}
	if err := fs.Parse(args); err != nil {
		t.Fatal(err)
	}
	if o.Rows != 32 || o.Chain != 1 || o.RGBSequence != "RGB" {
		t.Fatalf("panel flags not applied: %+v", *o)
	}
	if o.DropPrivileges {
		t.Fatal("-led-no-drop-privs should clear DropPrivileges")
	}
	if o.LimitRefreshRateHz != 100 || !o.ShowRefreshRate || !o.DisableBusyWaiting {
		t.Fatalf("runtime flags not applied: %+v", *o)
	}
}

func TestOpenUnavailableOffTarget(t *testing.T) {
	if _, err := Open(Default()); err == nil {
		t.Skip("running on the LED hardware")
	}
}

func TestPWMBitsFor(t *testing.T) {
	for hz, want := range map[int]int{60: 11, 82: 11, 83: 10, 96: 8, 102: 8, 120: 6, 123: 5, 150: 4, 160: 3, 200: 3} {
		if got := PWMBitsFor(hz); got != want {
			t.Errorf("PWMBitsFor(%d) = %d, want %d", hz, got, want)
		}
	}
}

func TestCorrectSequence(t *testing.T) {
	for _, tc := range []struct{ current, seen, want string }{
		{"RGB", "RGB", "RGB"},
		{"RGB", "GRB", "GRB"},
		{"RGB", "BGR", "BGR"},
		{"RGB", "GBR", "GBR"},
		{"GRB", "RGB", "GRB"},
		{"GRB", "GRB", "RGB"},
		{"BGR", "rgb", "BGR"},
		{"GBR", "BRG", "RGB"},
	} {
		got, err := CorrectSequence(tc.current, tc.seen)
		if err != nil || got != tc.want {
			t.Errorf("CorrectSequence(%q, %q) = %q, %v; want %q", tc.current, tc.seen, got, err, tc.want)
		}
	}
	for _, tc := range [][2]string{{"RGB", "RRB"}, {"RGB", "RG"}, {"RGX", "RGB"}} {
		if _, err := CorrectSequence(tc[0], tc[1]); err == nil {
			t.Errorf("CorrectSequence(%q, %q) accepted", tc[0], tc[1])
		}
	}
}

// A panel that correctly shows what it's sent shows each colour as itself.
func TestCorrectSequenceRoundTrip(t *testing.T) {
	for _, wiring := range Sequences {
		for _, current := range Sequences {
			// Line i lights wiring[i]; colour c goes out on the line at its index in the order.
			seen := make([]byte, 3)
			for i, c := range []byte("RGB") {
				seen[i] = wiring[strings.IndexByte(current, c)]
			}
			corrected, err := CorrectSequence(current, string(seen))
			if err != nil {
				t.Fatal(err)
			}
			for _, c := range []byte("RGB") {
				if shown := wiring[strings.IndexByte(corrected, c)]; shown != c {
					t.Errorf("wiring %s, order %s: corrected %s shows %c as %c", wiring, current, corrected, c, shown)
				}
			}
		}
	}
}
