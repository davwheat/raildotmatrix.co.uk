package setupdisplay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
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

func TestCachedLayoutMatchesScrollingAndPaging(t *testing.T) {
	status := Status{Mode: "connected", IPs: []string{"192.168.1.82", "10.0.0.1"}}
	path := filepath.Join(t.TempDir(), "network.json")
	data, _ := json.Marshal(status)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatal(err)
	}
	for _, size := range [][2]int{{128, 16}, {256, 32}, {512, 64}} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			b := Board{Path: path, Colour: frame.RGB{R: 230, G: 150}}
			f := frame.New(size[0], size[1])
			want := frame.New(size[0], size[1])
			for tick := range 1260 {
				now := time.Unix(100, 0).Add(time.Duration(tick) * time.Second / 60)
				b.Tick(now, f)
				// Draw the original geometry afresh, without cached text, measurements or positions.
				lines := Lines(status)
				lineHeight := font.Text.Height + 3
				perPage := max(1, f.H/lineHeight)
				start := int(now.Unix()/7) % ((len(lines) + perPage - 1) / perPage) * perPage
				lines = lines[start:min(start+perPage, len(lines))]
				want.Clear()
				y := max(0, (f.H-len(lines)*lineHeight)/2)
				for i, line := range lines {
					width := font.Text.Width(line)
					x := max(0, (f.W-width)/2)
					if width > f.W {
						x = -int(now.UnixMilli()/55)%(width+f.W) + f.W
					}
					font.Text.Draw(want, x, y+i*lineHeight, line, b.Colour)
				}
				if !bytes.Equal(f.Pix, want.Pix) {
					t.Fatalf("frame differs at tick %d", tick)
				}
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
