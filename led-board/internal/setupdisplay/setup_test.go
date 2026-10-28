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

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/formats"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
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
		{"no Wi-Fi or Ethernet", Status{Mode: "unavailable"}, []string{"Wi-Fi unavailable", "Retrying...", "Or connect Ethernet"}},
		{"hotspot activating", Status{Mode: "starting", SSID: "DepartureBoard", IPs: []string{"192.168.4.1"}}, []string{"Starting setup...", "Please wait"}},
		{"hotspot stalled", Status{Mode: "unavailable", IPs: []string{"192.168.4.1"}}, []string{"Wi-Fi unavailable", "Retrying...", "Or connect Ethernet"}},
		{"wired with unused hotspot", Status{Mode: "hotspot", IPs: []string{"192.168.4.1", "10.0.0.8"}}, []string{"Setup available", "http://departureboard.local", "http://10.0.0.8"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Lines(tc.status); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestLostConnectionInstructions(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status Status
		want   []string
	}{
		{"waiting for device", Status{Mode: "hotspot", IPs: []string{"192.168.4.1"}}, []string{"Wi-Fi connection lost", "Connect to DepartureBoard", "Password: DotMatrix"}},
		{"hotspot activating", Status{Mode: "starting", IPs: []string{"192.168.4.1"}}, []string{"Wi-Fi connection lost", "Starting setup..."}},
		{"device joined", Status{Mode: "hotspot", Clients: 1}, []string{"Setup available", "http://departureboard.local", "http://192.168.4.1"}},
		{"wired fallback", Status{Mode: "hotspot", IPs: []string{"192.168.4.1", "10.0.0.8"}}, []string{"Setup available", "http://departureboard.local", "http://10.0.0.8"}},
		{"no Wi-Fi or Ethernet", Status{Mode: "unavailable"}, []string{"Wi-Fi unavailable", "Retrying...", "Or connect Ethernet"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := LostLines(tc.status); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

// The departures must come back exactly as a board that never showed the instructions draws them, and skipping
// ticks until NextTick must not delay the instructions or the departures.
func TestOfflineShowsInstructionsOnlyOnTheHotspotWithoutAFeed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "network.json")
	config := formats.Config{Width: 256, Height: 64, ServiceCount: 3}
	departures := fixtures.Steps("busy-board")[0]
	phases := []struct {
		name     string
		mode     string
		ethernet bool
		view     model.View
		covered  bool
	}{
		{"feed connected", "connected", false, departures, false},
		{"Wi-Fi rejoining", "connecting", false, model.View{}, false},
		{"on the hotspot", "hotspot", false, model.View{}, true},
		{"joining a chosen network", "connecting", false, model.View{}, false},
		{"back on the hotspot", "hotspot", false, model.View{}, true},
		{"feed over Ethernet", "hotspot", true, departures, false},
		{"feed down over Ethernet", "hotspot", true, model.View{}, false},
		{"Ethernet unplugged", "hotspot", false, model.View{}, true},
	}
	for _, name := range formats.Names {
		t.Run(name, func(t *testing.T) {
			reference, _ := formats.New(name, config)
			regularBoard, _ := formats.New(name, config)
			scheduledBoard, _ := formats.New(name, config)
			setup := Board{Path: path, Colour: frame.RGB{R: 230, G: 150}, Lost: true}
			regular := &Offline{Board: regularBoard, Setup: setup}
			scheduled := &Offline{Board: scheduledBoard, Setup: setup}
			want, got, skipped := frame.New(config.Width, config.Height), frame.New(config.Width, config.Height), frame.New(config.Width, config.Height)
			var next time.Time
			for i, phase := range phases {
				ips := []string{"192.168.4.1"}
				if phase.ethernet {
					ips = append(ips, "10.0.0.8")
				}
				data, _ := json.Marshal(Status{Mode: phase.mode, IPs: ips})
				if err := os.WriteFile(path, data, 0644); err != nil {
					t.Fatal(err)
				}
				// Only the feed wakes an idle board. A new status alone must be picked up by the poll deadline.
				updated := i == 0 || !reflect.DeepEqual(phase.view, phases[i-1].view)
				if updated {
					for _, b := range []interface{ Update(model.View) }{reference, regular, scheduled} {
						b.Update(phase.view)
					}
					next = time.Time{}
				}
				for tick := range 1000 {
					now := fixtures.Clock.Add(time.Duration(i*1000+tick) * 5 * time.Millisecond)
					reference.Tick(now, want)
					regular.Tick(now, got)
					if next.IsZero() || !now.Before(next) {
						scheduled.Tick(now, skipped)
						next = scheduled.NextTick(now)
					}
					if !skipped.Equal(got) {
						t.Fatalf("%s, tick %d: postponed a visible change until %s", phase.name, tick, next)
					}
					// The status is read once a second, so a change to it alone can take that long to show.
					if (tick >= 200 || updated) && got.Equal(want) == phase.covered {
						t.Fatalf("%s, tick %d: instructions shown %t, want %t", phase.name, tick, !got.Equal(want), phase.covered)
					}
				}
			}
		})
	}
}

type idleBoard struct{}

func (idleBoard) Update(model.View)                 {}
func (idleBoard) Tick(time.Time, *frame.Frame) bool { return false }
func (idleBoard) RefreshHz() int                    { return 60 }
func (idleBoard) NextTick(now time.Time) time.Time  { return now.Add(time.Hour) }

func TestOfflineOnAnIdleBoard(t *testing.T) {
	path := filepath.Join(t.TempDir(), "network.json")
	setStatus := func(mode string) {
		data, _ := json.Marshal(Status{Mode: mode})
		if err := os.WriteFile(path, data, 0644); err != nil {
			t.Fatal(err)
		}
	}
	// The instructions neither scroll nor page at this size, so nothing but the switch itself redraws them.
	f, blank := frame.New(1024, 128), frame.New(1024, 128)
	o := &Offline{Board: idleBoard{}, Setup: Board{Path: path, Colour: frame.RGB{R: 230, G: 150}, Lost: true}}
	setStatus("connecting")
	o.Update(model.View{})
	now := time.Unix(700, 0)
	o.Tick(now, f)
	if next := o.NextTick(now); next.After(now.Add(time.Second)) {
		t.Fatalf("next tick at %s, want a status poll within a second", next.Sub(now))
	}
	for _, mode := range []string{"hotspot", "connecting", "hotspot"} {
		setStatus(mode)
		now = now.Add(time.Second)
		if !o.Tick(now, f) || f.Equal(blank) != (mode == "connecting") {
			t.Fatalf("%s: instructions not shown or removed", mode)
		}
	}
	o.Update(model.View{Connected: true})
	if !o.Tick(now, f) || !f.Equal(blank) {
		t.Fatal("instructions stayed after the feed returned")
	}
	if next := o.NextTick(now); !next.Equal(now.Add(time.Hour)) {
		t.Fatalf("next tick at %s, want the board's own deadline while the feed is up", next.Sub(now))
	}
	o.Update(model.View{})
	if !o.Tick(now, f) || f.Equal(blank) {
		t.Fatal("unchanged instructions not shown again when the feed dropped")
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

func TestDeadlinesPreservePollingPagingAndScrolling(t *testing.T) {
	path := filepath.Join(t.TempDir(), "network.json")
	for _, size := range [][2]int{{128, 16}, {256, 32}, {512, 64}} {
		regular := Board{Path: path, Colour: frame.RGB{R: 230, G: 150}}
		scheduled := regular
		want, got := frame.New(size[0], size[1]), frame.New(size[0], size[1])
		var next time.Time
		for tick := range 6000 {
			now := time.Unix(100, 0).Add(time.Duration(tick) * 7 * time.Millisecond)
			if tick%1000 == 0 {
				status := Status{Mode: "hotspot", Clients: tick / 1000 % 2, IPs: []string{"192.168.4.1", "10.0.0.1"}}
				data, _ := json.Marshal(status)
				if err := os.WriteFile(path, data, 0644); err != nil {
					t.Fatal(err)
				}
			}
			regular.Tick(now, want)
			if next.IsZero() || !now.Before(next) {
				scheduled.Tick(now, got)
				next = scheduled.NextTick(now)
			}
			if !got.Equal(want) {
				t.Fatalf("size %v, tick %d: deadline missed an update", size, tick)
			}
		}
	}
}
