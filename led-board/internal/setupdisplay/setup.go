// Package setupdisplay shows connection instructions until a station is chosen.
package setupdisplay

import (
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Status is written atomically by the manager and read after the GPIO privilege drop.
type Status struct {
	Clients int      `json:"clients"`
	Mode    string   `json:"mode"`
	SSID    string   `json:"ssid"`
	IPs     []string `json:"ips"`
	Message string   `json:"message"`
	Country string   `json:"country"`
}

func Lines(s Status) []string {
	switch s.Mode {
	case "hotspot":
		if s.Clients > 0 {
			return []string{"Setup available", "http://departureboard.local", "http://192.168.4.1"}
		}
		// A wired connection can provide setup access before anyone joins Wi-Fi.
		for _, ip := range s.IPs {
			if ip != "192.168.4.1" {
				s.Mode = "connected"
				return Lines(s)
			}
		}
		return []string{"Connect to DepartureBoard", "Password: DotMatrix"}
	case "connected":
		lines := []string{"Setup available", "http://departureboard.local"}
		for _, ip := range s.IPs {
			if ip != "192.168.4.1" {
				lines = append(lines, "http://"+ip)
			}
		}
		return lines
	case "connecting":
		return []string{"Connecting to Wi-Fi", s.SSID, "Please wait..."}
	default:
		if len(s.IPs) > 0 {
			s.Mode = "connected"
			return Lines(s)
		}
		return []string{"Starting setup...", "Please wait"}
	}
}

type Board struct {
	Path     string
	Colour   frame.RGB
	status   Status
	readAt   time.Time
	previous string
}

func (*Board) Update(model.View) {}
func (*Board) RefreshHz() int    { return 60 }
func (b *Board) Tick(now time.Time, f *frame.Frame) bool {
	if now.Sub(b.readAt) >= time.Second {
		if data, err := os.ReadFile(b.Path); err == nil {
			var s Status
			if json.Unmarshal(data, &s) == nil {
				b.status = s
			}
		}
		b.readAt = now
	}
	lines := Lines(b.status)
	lineHeight := font.Text.Height + 3
	perPage := max(1, f.H/lineHeight)
	pages := (len(lines) + perPage - 1) / perPage
	start := int(now.Unix()/7) % pages * perPage
	lines = lines[start:min(start+perPage, len(lines))]
	// Long addresses scroll instead of being clipped on smaller panel layouts.
	positions := make([]int, len(lines))
	for i, line := range lines {
		width := font.Text.Width(line)
		positions[i] = max(0, (f.W-width)/2)
		if width > f.W {
			positions[i] = -int(now.UnixMilli()/55)%(width+f.W) + f.W
		}
	}
	state, _ := json.Marshal(positions)
	key := strings.Join(lines, "\n") + string(state)
	if key == b.previous {
		return false
	}
	f.Clear()
	y := max(0, (f.H-len(lines)*lineHeight)/2)
	for i, line := range lines {
		font.Text.Draw(f, positions[i], y+i*lineHeight, line, b.Colour)
	}
	b.previous = key
	return true
}
