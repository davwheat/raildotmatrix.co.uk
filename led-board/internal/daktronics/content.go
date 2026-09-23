package daktronics

import (
	"strconv"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// row is one train's line as the board shows it, derived once per view so that ticks only copy strings.
type row struct {
	id     string
	prefix string
	std    string
	// pages are the destination texts a later train cycles through every three seconds: each destination with
	// its ", " or " & " suffix, as TrainService.tsx builds them.
	pages []string
	// line1 and line2 are the first train's destinations as one wrapped text; line2 is empty unless the text
	// needs the "triple line" layout.
	line1, line2 string
	etd          string
	dividing     bool
}

// page is one screen of the information row: a prefix that drops in at the right edge, then the text that
// scrolls behind it.
type page struct{ prefix, text string }

// content is everything derived from a view that the renderer reads.
type content struct {
	rows    []row
	pages   []page
	warning [3]string
}

func (b *Board) derive(v model.View) content {
	var c content
	c.warning = warningLines(v.Notice, b.warningPlatform(v))
	for i := range v.Services {
		if i == 3 {
			break
		}
		s := &v.Services[i]
		r := row{
			id:       s.ID,
			prefix:   b.cfg.RowPrefix.Text(i, s.Platform, b.cfg.OrdinalFormat),
			std:      s.STD(b.cfg.Zone),
			etd:      s.ETD(b.cfg.Zone),
			dividing: len(s.Destinations) > 1,
			pages:    destinationPages(s, b.cfg.WorldlinePowered),
		}
		if i == 0 {
			r.line1, r.line2 = b.wrapDestination(strings.Join(r.pages, ""))
			c.pages = b.infoPages(s)
		}
		c.rows = append(c.rows, r)
	}
	return c
}

func destinationPages(s *model.Service, upper bool) []string {
	pages := make([]string, 0, len(s.Destinations))
	for i, d := range s.Destinations {
		name := stationName(d.CRS, d.Name)
		if upper {
			name = strings.ToUpper(name)
		}
		switch remaining := len(s.Destinations) - i; {
		case remaining == 2:
			name += " & "
		case remaining > 2:
			name += ", "
		}
		pages = append(pages, name)
	}
	return pages
}

// wrapDestination splits the first train's destination text the way the browser wraps it: the first line is
// limited to the destination column, and a second line may run under the ETD column to the board's edge. A
// word that fits no line is clipped where it stands rather than broken.
func (b *Board) wrapDestination(text string) (line1, line2 string) {
	g := &b.geo
	if font.Text.Width(text) <= g.destW {
		return text, ""
	}
	words := strings.Split(text, " ")
	fit := 0
	for i := range words {
		candidate := strings.Join(words[:i+1], " ")
		if font.Text.Width(candidate) > g.destW && i > 0 {
			break
		}
		fit = i + 1
	}
	return strings.Join(words[:fit], " "), strings.Join(words[fit:], " ")
}

func (b *Board) infoPages(s *model.Service) []page {
	if b.cfg.WorldlinePowered {
		return []page{{text: worldlineInfo(s)}}
	}
	pages := []page{{prefix: infoPrefix(s), text: serviceInfo(s)}}
	for _, cp := range callingPointPages(s) {
		pages = append(pages, page{prefix: cp.prefix + ":", text: " " + joinCalls(cp.points, false)})
	}
	return pages
}

func infoPrefix(s *model.Service) string {
	if s.TOC == "" {
		return "A"
	}
	return s.TOC
}

// serviceInfo mirrors getServiceInfo in TrainServiceAdditionalInfo.tsx: the operator name is supplied by the
// prefix, so the text opens mid-sentence.
func serviceInfo(s *model.Service) string {
	parts := []string{" service."}
	switch {
	case s.TerminatesHere:
		parts = append(parts, "This is the service from "+board.CombineNames(s.Origins)+".")
	case s.Length > 0:
		parts = append(parts, "Formed of "+strconv.Itoa(s.Length)+" coaches.")
	}
	if reason := reasonText(s); reason != "" {
		parts = append(parts, reason)
	}
	return strings.Join(parts, " ")
}

func worldlineInfo(s *model.Service) string {
	var parts []string
	switch {
	case s.TerminatesHere:
		parts = append(parts, "A "+s.TOC+" service.", "This is the service from "+board.CombineNames(s.Origins)+".")
	case s.Length > 0:
		parts = append(parts, "A "+s.TOC+" service which has "+strconv.Itoa(s.Length)+" coaches.")
	default:
		parts = append(parts, "A "+s.TOC+" service.")
	}
	if reason := reasonText(s); reason != "" {
		parts = append(parts, reason)
	}
	for _, cp := range callingPointPages(s) {
		parts = append(parts, cp.prefix+" "+joinCalls(cp.points, true))
	}
	return strings.Join(parts, " ")
}

func reasonText(s *model.Service) string {
	switch {
	case s.Cancelled:
		return s.CancelReason
	case s.Delayed():
		return s.DelayReason
	}
	return ""
}

type callingPage struct {
	prefix string
	points []string
}

// callingPointPages lists the calling points of each portion of a train, as the web board does: the whole
// train's calls first, then each portion's calls from the point it divides.
func callingPointPages(s *model.Service) []callingPage {
	if s.TerminatesHere {
		return nil
	}
	all := make([]string, len(s.CallPoints))
	for i, cp := range s.CallPoints {
		all[i] = cp.Name
	}
	var portions []model.Portion
	var pages []callingPage
	for i, cp := range s.CallPoints {
		for _, p := range cp.Divides {
			calls := append([]string{}, all[:i+1]...)
			for j, pc := range p.CallPoints {
				if j == 0 && pc.Name == cp.Name {
					continue
				}
				calls = append(calls, pc.Name)
			}
			portions = append(portions, p)
			pages = append(pages, callingPage{points: calls})
		}
	}
	if len(pages) == 0 {
		return []callingPage{{prefix: "Calling at", points: all}}
	}
	for i := range pages {
		position := "Middle"
		if i == len(pages)-1 {
			position = "Rear"
		}
		pages[i].prefix = coaches(position, portions[i].Length)
	}
	front := callingPage{prefix: coaches("Front", s.CallPoints[len(s.CallPoints)-1].Length), points: all}
	return append([]callingPage{front}, pages...)
}

func coaches(position string, length int) string {
	if length > 0 {
		return position + " " + strconv.Itoa(length) + " coaches calling at"
	}
	return position + " coaches calling at"
}

// joinCalls formats calling points as CallingPoint in CallingPoints.tsx does: comma separated and ending in a
// full stop, with the last one in capitals; the Worldline variant instead joins the last two with "and".
func joinCalls(points []string, worldline bool) string {
	var sb strings.Builder
	for i, p := range points {
		last := i == len(points)-1
		switch {
		case last && !worldline:
			sb.WriteString(strings.ToUpper(p))
			sb.WriteString(".")
		case last:
			sb.WriteString(p)
			sb.WriteString(".")
		case worldline && i == len(points)-2:
			sb.WriteString(p)
			sb.WriteString(" and ")
		default:
			sb.WriteString(p)
			sb.WriteString(", ")
		}
	}
	return sb.String()
}

func (b *Board) warningPlatform(v model.View) string {
	if !b.cfg.WarningPlatform {
		return ""
	}
	return v.NoticePlatform
}

// warningLines names platform in place of "this station" when it's set.
func warningLines(n model.Notice, platform string) [3]string {
	switch {
	case n == model.NotForPublicUse && platform != "":
		return [3]string{"PLEASE STAND CLEAR", "The next train at platform " + platform, "is not for public use"}
	case n == model.NotForPublicUse:
		return [3]string{"PLEASE STAND CLEAR", "The next train is not", "for public use"}
	case platform != "":
		return [3]string{"PLEASE STAND CLEAR", "The next train is not scheduled", "to call at platform " + platform}
	}
	return [3]string{"PLEASE STAND CLEAR", "The next train is not scheduled", "to call at this station"}
}

func clockDigits(now time.Time, zone *time.Location) [8]byte {
	var d [8]byte
	now.In(zone).AppendFormat(d[:0], "15:04:05")
	return d
}
