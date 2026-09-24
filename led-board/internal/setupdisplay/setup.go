// Package setupdisplay shows connection instructions until a station is chosen.
package setupdisplay

import (
	"encoding/json"
	"os"
	"slices"
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
	Path   string
	Colour frame.RGB
	status Status
	readAt time.Time
	lines  []string
	widths []int
	x      []int
	page   int
	w, h   int
	colour frame.RGB
	drawn  bool
}

func (*Board) Update(model.View) {}
func (*Board) RefreshHz() int    { return 60 }
func (b *Board) Tick(now time.Time, f *frame.Frame) bool {
	if now.Sub(b.readAt) >= time.Second {
		if data, err := os.ReadFile(b.Path); err == nil {
			var s Status
			if json.Unmarshal(data, &s) == nil {
				b.status = s
				b.setLines(Lines(s))
			}
		}
		b.readAt = now
	}
	if b.lines == nil {
		b.setLines(Lines(b.status))
	}
	lineHeight := font.Text.Height + 3
	perPage := max(1, f.H/lineHeight)
	pages := (len(b.lines) + perPage - 1) / perPage
	start := int(now.Unix()/7) % pages * perPage
	end := min(start+perPage, len(b.lines))
	changed := !b.drawn || start != b.page || f.W != b.w || f.H != b.h || b.Colour != b.colour
	// Long addresses scroll instead of being clipped on smaller panel layouts.
	for i := start; i < end; i++ {
		width := b.widths[i]
		x := max(0, (f.W-width)/2)
		if width > f.W {
			x = -int(now.UnixMilli()/55)%(width+f.W) + f.W
		}
		changed = changed || x != b.x[i]
		b.x[i] = x
	}
	if !changed {
		return false
	}
	f.Clear()
	y := max(0, (f.H-(end-start)*lineHeight)/2)
	for i := start; i < end; i++ {
		font.Text.Draw(f, b.x[i], y+(i-start)*lineHeight, b.lines[i], b.Colour)
	}
	b.page, b.w, b.h, b.colour, b.drawn = start, f.W, f.H, b.Colour, true
	return true
}

// Status is polled once a second; text and font measurements stay valid between changes. In particular, a
// client count change that leaves the same setup instructions on screen needs no new layout or redraw.
func (b *Board) setLines(lines []string) {
	if slices.Equal(lines, b.lines) {
		return
	}
	b.lines = lines
	b.widths = make([]int, len(lines))
	b.x = make([]int, len(lines))
	for i, line := range lines {
		b.widths[i] = font.Text.Width(line)
	}
	b.drawn = false
}
