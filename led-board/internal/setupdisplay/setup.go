// Package setupdisplay shows connection instructions until a station is chosen, and again whenever a configured
// board loses its Wi-Fi network.
package setupdisplay

import (
	"encoding/json"
	"os"
	"slices"
	"sync/atomic"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
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
		if reachable(s.IPs) {
			s.Mode = "connected"
			return Lines(s)
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
	case "unavailable":
		if reachable(s.IPs) {
			s.Mode = "connected"
			return Lines(s)
		}
		// The manager retries the hotspot on every poll, and a wired connection gives setup access meanwhile.
		return []string{"Wi-Fi unavailable", "Retrying...", "Or connect Ethernet"}
	default:
		if reachable(s.IPs) {
			s.Mode = "connected"
			return Lines(s)
		}
		return []string{"Starting setup...", "Please wait"}
	}
}

// LostLines tells someone how to reconnect a configured board that couldn't join its saved network. The manager
// stays on the setup hotspot until someone chooses a network again, so the board must say why it's there.
func LostLines(s Status) []string {
	if s.Clients == 0 && !reachable(s.IPs) {
		switch s.Mode {
		case "hotspot":
			return []string{"Wi-Fi connection lost", "Connect to DepartureBoard", "Password: DotMatrix"}
		case "starting":
			return []string{"Wi-Fi connection lost", "Starting setup..."}
		}
	}
	return Lines(s)
}

// The hotspot holds 192.168.4.1 while it is still starting, before any device can join it.
func reachable(ips []string) bool {
	return slices.ContainsFunc(ips, func(ip string) bool { return ip != "192.168.4.1" })
}

type Board struct {
	Path   string
	Colour frame.RGB
	// Lost shows LostLines in place of Lines.
	Lost   bool
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

// Keep the existing status poll and page/scroll deadlines while letting the
// panel refresh independently between changes to the setup instructions.
func (b *Board) NextTick(now time.Time) time.Time {
	if !b.drawn {
		return time.Time{}
	}
	next := b.readAt.Add(time.Second)
	perPage := max(1, b.h/(font.Text.Height+3))
	if len(b.lines) > perPage {
		if page := time.Unix((now.Unix()/7+1)*7, 0); page.Before(next) {
			next = page
		}
	}
	for i := b.page; i < min(b.page+perPage, len(b.lines)); i++ {
		if b.widths[i] > b.w {
			if scroll := time.UnixMilli((now.UnixMilli()/55 + 1) * 55); scroll.Before(next) {
				next = scroll
			}
			break
		}
	}
	return next
}

func (b *Board) Tick(now time.Time, f *frame.Frame) bool {
	b.poll(now)
	if b.lines == nil {
		b.setLines(b.instructions(b.status))
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

func (b *Board) poll(now time.Time) {
	if !now.Before(b.readAt) && now.Sub(b.readAt) < time.Second {
		return
	}
	if data, err := os.ReadFile(b.Path); err == nil {
		var s Status
		if json.Unmarshal(data, &s) == nil {
			b.status = s
			b.setLines(b.instructions(s))
		}
	}
	b.readAt = now
}

func (b *Board) instructions(s Status) []string {
	if b.Lost {
		return LostLines(s)
	}
	return Lines(s)
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

// Offline shows Setup in place of a configured board while the board is on the setup hotspot and has no feed.
type Offline struct {
	board.Board
	Setup     Board
	connected atomic.Bool
	// The departure board draws into a frame of its own, so its record of what it drew stays true while Setup
	// covers it, and it needs no full redraw when the feed returns.
	own     *frame.Frame
	showing bool
}

func (o *Offline) Update(v model.View) {
	o.connected.Store(v.Connected)
	o.Board.Update(v)
}

func (o *Offline) ServiceLimit() int { return board.ServiceLimit(o.Board) }

func (o *Offline) Tick(now time.Time, f *frame.Frame) bool {
	if o.own == nil || o.own.W != f.W || o.own.H != f.H {
		o.own = frame.New(f.W, f.H)
	}
	changed := o.Board.Tick(now, o.own)
	if o.lost(now) {
		if !o.showing {
			o.Setup.drawn = false
		}
		o.showing = true
		return o.Setup.Tick(now, f)
	}
	if !changed && !o.showing {
		return false
	}
	o.showing = false
	copy(f.Pix, o.own.Pix)
	return true
}

// The status file is only read while the feed is down, which is the only time it can change what's on screen. A
// board on Ethernet keeps the hotspot up, so a feed outage there is not a lost connection unless someone has joined
// the hotspot to fix it.
func (o *Offline) lost(now time.Time) bool {
	if o.connected.Load() {
		return false
	}
	o.Setup.poll(now)
	s := o.Setup.status
	switch s.Mode {
	case "hotspot", "starting", "unavailable":
		return s.Clients > 0 || !reachable(s.IPs)
	}
	return false
}

func (o *Offline) NextTick(now time.Time) time.Time {
	if o.showing {
		return o.Setup.NextTick(now)
	}
	var next time.Time
	if deadlines, ok := o.Board.(board.NextTicker); ok {
		next = deadlines.NextTick(now)
	}
	if poll := o.Setup.readAt.Add(time.Second); !o.connected.Load() && !next.IsZero() && poll.Before(next) {
		return poll
	}
	return next
}
