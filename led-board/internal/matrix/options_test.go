package matrix

import (
	"flag"
	"io"
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
		"-led-no-drop-privs", "-led-limit-refresh=100", "-led-show-refresh",
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
	if o.LimitRefreshRateHz != 100 || !o.ShowRefreshRate {
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
