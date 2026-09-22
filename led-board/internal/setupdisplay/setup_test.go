package setupdisplay

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestSetupInstructions(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status Status
		want   []string
	}{
		{"waiting for device", Status{Mode: "hotspot"}, []string{"Connect to DepartureBoard", "Password: DotMatrix"}},
		{"first device joined", Status{Mode: "hotspot", Clients: 1}, []string{"Setup available", "http://departureboard.local", "http://192.168.4.1"}},
		{"other devices remain", Status{Mode: "hotspot", Clients: 2}, []string{"Setup available", "http://departureboard.local", "http://192.168.4.1"}},
		{"joined network", Status{Mode: "connected", IPs: []string{"192.168.1.82"}}, []string{"Setup available", "http://departureboard.local", "http://192.168.1.82"}},
		{"wired fallback", Status{Mode: "unavailable", IPs: []string{"10.0.0.8"}}, []string{"Setup available", "http://departureboard.local", "http://10.0.0.8"}},
		{"wired with unused hotspot", Status{Mode: "hotspot", IPs: []string{"192.168.4.1", "10.0.0.8"}}, []string{"Setup available", "http://departureboard.local", "http://10.0.0.8"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Lines(tc.status); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestDisplayChangesWhenClientsJoinAndLeave(t *testing.T) {
	path := filepath.Join(t.TempDir(), "network.json")
	b := Board{Path: path, Colour: frame.RGB{R: 255, G: 160}}
	f := frame.New(512, 64)
	now := time.Unix(100, 0)
	var waiting, connected []byte
	for i, clients := range []int{0, 1, 2, 1, 0} {
		data, _ := json.Marshal(Status{Mode: "hotspot", Clients: clients})
		if err := os.WriteFile(path, data, 0644); err != nil {
			t.Fatal(err)
		}
		changed := b.Tick(now.Add(time.Duration(i)*time.Second), f)
		if i == 0 {
			waiting = bytes.Clone(f.Pix)
		}
		if i == 1 {
			connected = bytes.Clone(f.Pix)
		}
		if (i == 0 || i == 1 || i == 4) != changed {
			t.Fatalf("clients %d: unexpected redraw %t", clients, changed)
		}
	}
	if bytes.Equal(waiting, connected) || !bytes.Equal(waiting, f.Pix) {
		t.Fatal("display did not change and return to connection instructions")
	}
	// A partial/unreadable status update must keep the last usable instructions.
	if err := os.WriteFile(path, []byte("{"), 0644); err != nil {
		t.Fatal(err)
	}
	if b.Tick(now.Add(6*time.Second), f) {
		t.Fatal("invalid status replaced the last good display")
	}
}
