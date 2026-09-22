package infotec

import (
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// destinationMaxLength is the longest destination and via text TrainService.tsx shows on one page.
const destinationMaxLength = 21

// row is one train's line as the board shows it, derived once per view so that ticks only copy strings.
type row struct {
	id     string
	prefix string
	// std is the scheduled time as HHmm, drawn in digit cells.
	std string
	// pages are the destination texts the row cycles through every three seconds.
	pages []string
	// etd is "On time", "Cancelled", "Arrived", "Delayed", or an expected time as HHmm.
	etd       string
	cancelled bool
}

// page is one screen of the information row: a prefix fixed at the left edge and the text that scrolls
// beside it, or the service information alone.
type page struct {
	prefix, text string
	// hold is how long the page stays when its text fits the row.
	hold int64
}

// content is everything derived from a view that the renderer reads.
type content struct {
	rows    []row
	pages   []page
	warning [3]string
}

func (b *Board) derive(v model.View) content {
	var c content
	c.warning = warningLines(v.Notice, b.warningPlatform(v))
	for i := range min(len(v.Services), 3) {
		s := &v.Services[i]
		c.rows = append(c.rows, row{
			id:        s.ID,
			prefix:    b.cfg.RowPrefix.Text(i, s.Platform),
			std:       s.STD(b.cfg.Zone),
			pages:     destinationPages(s),
			etd:       b.etd(s),
			cancelled: s.Cancelled,
		})
		if i == 0 {
			c.pages = b.infoPages(s)
		}
	}
	return c
}

// etd mirrors displayedDepartureTime with the default onTimeText: a forecast equal to the timetable reads
// "On time".
func (b *Board) etd(s *model.Service) string {
	etd := s.ETD(b.cfg.Zone)
	if etd == s.STD(b.cfg.Zone) {
		return "On time"
	}
	return etd
}

func isTime(s string) bool {
	if len(s) != 4 {
		return false
	}
	for i := range 4 {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// destinationPages mirrors getDestinationAsStrings: a destination and its via share a page when short enough,
// else take one each.
func destinationPages(s *model.Service) []string {
	pages := make([]string, 0, len(s.Destinations))
	for i, d := range s.Destinations {
		name := d.Name
		if i > 0 {
			name = "and " + name
		}
		if d.Via == "" {
			pages = append(pages, name)
			continue
		}
		whole := strings.TrimSpace(name + " " + d.Via)
		if utf8.RuneCountInString(whole) <= destinationMaxLength {
			pages = append(pages, whole)
		} else {
			pages = append(pages, name, d.Via)
		}
	}
	return pages
}

func (b *Board) infoPages(s *model.Service) []page {
	pages := []page{{text: serviceInfo(s), hold: infoHold}}
	for _, cp := range b.callingPointPages(s) {
		pages = append(pages, page{prefix: cp.prefix, text: joinCalls(cp.points), hold: callingHold})
	}
	return pages
}

// serviceInfo mirrors getServiceInfo in TrainServiceAdditionalInfo.tsx.
func serviceInfo(s *model.Service) string {
	var parts []string
	if s.TerminatesHere {
		parts = append(parts, s.TOC+" service. This is the service from "+board.CombineNames(s.Origins)+".")
	} else {
		text := article(s.TOC)
		if s.TOC != "" {
			text += " " + s.TOC
		}
		text += " service"
		if s.Length > 0 {
			text += " formed of " + strconv.Itoa(s.Length) + " coaches"
		}
		parts = append(parts, text+".")
	}
	switch {
	case s.Cancelled && s.CancelReason != "":
		parts = append(parts, s.CancelReason)
	case !s.Cancelled && s.Delayed() && s.DelayReason != "":
		parts = append(parts, s.DelayReason)
	}
	return strings.Join(parts, " ")
}

func article(toc string) string {
	switch toc {
	case "Avanti West Coast", "Elizabeth Line", "East Midlands Railway", "Island Line":
		return "An"
	}
	return "A"
}

type callingPage struct {
	prefix string
	points []string
}

// callingPointPages lists the calling points of each portion of a train, as the web board does: the whole
// train's calls first, then each portion's calls from the point it divides.
func (b *Board) callingPointPages(s *model.Service) []callingPage {
	if s.TerminatesHere {
		return nil
	}
	all := make([]string, len(s.CallPoints))
	for i, cp := range s.CallPoints {
		all[i] = b.callText(cp)
	}
	var pages []callingPage
	var lengths []int
	for _, cp := range s.CallPoints {
		for _, p := range cp.Divides {
			if len(p.CallPoints) == 0 {
				continue
			}
			divide := 0
			for i := range s.CallPoints {
				if s.CallPoints[i].Name == p.CallPoints[0].Name {
					divide = i + 1
					break
				}
			}
			points := append([]string{}, all[:divide]...)
			for _, pc := range p.CallPoints[1:] {
				points = append(points, b.callText(pc))
			}
			pages = append(pages, callingPage{points: points})
			lengths = append(lengths, p.Length)
		}
	}
	if len(pages) == 0 {
		return []callingPage{{prefix: "Calling at:", points: all}}
	}
	for i := range pages {
		position := "Middle"
		if i == len(pages)-1 {
			position = "Rear"
		}
		pages[i].prefix = coaches(position, lengths[i])
	}
	front := callingPage{prefix: coaches("Front", s.CallPoints[len(s.CallPoints)-1].Length), points: all}
	return append([]callingPage{front}, pages...)
}

func (b *Board) callText(cp model.CallPoint) string {
	if cp.Arrival == nil {
		return cp.Name
	}
	return cp.Name + " (" + cp.Arrival.In(b.cfg.Zone).Format("15:04") + ")"
}

func coaches(position string, length int) string {
	if length > 0 {
		return position + " " + strconv.Itoa(length) + " coaches:"
	}
	return position + " coaches:"
}

// joinCalls punctuates calling points as the ::after rules in trainServiceAdditionalInfo.scss do.
func joinCalls(points []string) string {
	switch len(points) {
	case 0:
		return ""
	case 1:
		return points[0] + " only."
	}
	return strings.Join(points[:len(points)-1], ", ") + " and " + points[len(points)-1] + "."
}

var nreLines = [3]string{"Please listen for announcements", "or call National Rail Enquiries", "on 03457 48 49 50"}

func (b *Board) warningPlatform(v model.View) string {
	if !b.cfg.WarningPlatform {
		return ""
	}
	return v.NoticePlatform
}

// warningLines names platform in place of "here" when it's set. A platform doesn't fit on the one line that
// says a train isn't for public use, so that warning gives up the platform edge line to make room.
func warningLines(n model.Notice, platform string) [3]string {
	lines := [3]string{"* PLEASE STAND CLEAR *", "OF THE PLATFORM EDGE", "THE NEXT TRAIN MAY NOT STOP HERE"}
	switch {
	case n == model.NotForPublicUse && platform != "":
		lines[1], lines[2] = "THE NEXT TRAIN AT PLATFORM "+platform, "IS NOT FOR PUBLIC USE"
	case n == model.NotForPublicUse:
		lines[2] = "THE NEXT TRAIN IS NOT FOR PUBLIC USE"
	case platform != "":
		lines[2] = "THE NEXT TRAIN MAY NOT STOP AT PLATFORM " + platform
	}
	return lines
}

func clockDigits(now time.Time, zone *time.Location) [8]byte {
	var d [8]byte
	now.In(zone).AppendFormat(d[:0], "15:04:05")
	return d
}
