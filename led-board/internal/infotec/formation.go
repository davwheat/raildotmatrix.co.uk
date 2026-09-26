package infotec

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// DefaultFormationIcons returns all facility icon types in display priority order.
func DefaultFormationIcons() []string {
	return []string{"accessibility", "cycles", "toilets", "food", "first-class"}
}

func ValidateFormationIcons(icons []string) error {
	for _, icon := range icons {
		if !slices.Contains(DefaultFormationIcons(), icon) {
			return fmt.Errorf("unknown formation icon %q; want accessibility, cycles, toilets, food or first-class", icon)
		}
	}
	return nil
}

// DefaultCoachLetterTOCs returns the operators whose formations show coach letters by default.
func DefaultCoachLetterTOCs() []string {
	return []string{"VT", "GR", "GW", "LD", "LF", "GC", "HT", "SR", "AW", "EM"}
}

func (b *Board) showCoachLetters(toc string) bool {
	toc = strings.TrimSpace(toc)
	if toc == "" {
		return false
	}
	for _, allowed := range b.cfg.CoachLetterTOCs {
		if strings.EqualFold(toc, strings.TrimSpace(allowed)) {
			return true
		}
	}
	return false
}

type coachContent struct {
	text    string
	loading int
}

var emptyFormation [128]coachContent

// derive owns each coach slice and never changes it. A different backing array
// therefore invalidates the page even when an update arrives at the same time.
// Two buffers keep the previous scene immutable until Tick has compared it with
// the new scene, without allocating a page on every five-second transition.
type formationCache struct {
	coaches []model.Coach
	slot    time.Duration
	current *[128]coachContent
	pages   [2][128]coachContent
}

func (b *Board) cachedFormation(coaches []model.Coach, elapsed time.Duration) *[128]coachContent {
	if len(coaches) == 0 {
		b.formation.coaches = nil
		return &emptyFormation
	}
	c := &b.formation
	slot := max(0, elapsed) / (5 * time.Second)
	if len(c.coaches) == len(coaches) && &c.coaches[0] == &coaches[0] && c.slot == slot {
		return c.current
	}
	next := &c.pages[0]
	if next == c.current {
		next = &c.pages[1]
	}
	*next = b.formationContents(coaches, elapsed)
	if c.current == nil || *next != *c.current {
		c.current = next
	}
	c.coaches, c.slot = coaches, slot
	return c.current
}

// Shared five-second slots show identifiers, loading, then facilities. Extra
// facility slots repeat accessibility first, then cycles, toilets, food and first class.
func (b *Board) formationContents(coaches []model.Coach, elapsed time.Duration) (out [128]coachContent) {
	labels, loads, facilities := false, false, 0
	for _, c := range coaches {
		labels = labels || c.Label != ""
		loads = loads || c.Loading >= 0
		_, count := b.coachFacilities(c)
		facilities = max(facilities, count)
	}
	slots := facilities
	if labels {
		slots++
	}
	if loads {
		slots++
	}
	if slots == 0 {
		return
	}
	slot := int(max(0, elapsed)/(5*time.Second)) % slots
	for i, c := range coaches {
		if i >= len(out) {
			break
		}
		out[i].loading = -1
		page := slot
		if labels {
			if page == 0 {
				out[i].text = c.Label
				continue
			}
			page--
		}
		if loads {
			if page == 0 {
				out[i].loading = c.Loading
				continue
			}
			page--
		}
		options, count := b.coachFacilities(c)
		if count != 0 {
			out[i].text = options[max(0, page-(facilities-count))]
		}
	}
	return
}

// There are at most five facility types. Keep their short list on the stack;
// formationContents examines it when selecting a new five-second page.
func (b *Board) coachFacilities(c model.Coach) (options [5]string, count int) {
	add := func(icon string) {
		options[count] = icon
		count++
	}
	accessible := c.Accessible && slices.Contains(b.cfg.FormationIcons, "accessibility")
	if accessible {
		add("§")
	}
	if c.Cycles && slices.Contains(b.cfg.FormationIcons, "cycles") {
		add("#")
	}
	if c.Toilet && !accessible && slices.Contains(b.cfg.FormationIcons, "toilets") {
		add("±")
	}
	if c.Food && slices.Contains(b.cfg.FormationIcons, "food") {
		add("€")
	}
	if c.FirstClass && slices.Contains(b.cfg.FormationIcons, "first-class") {
		add("1st")
	}
	return
}

func drawFormationContents(f *frame.Frame, x, y, width, height, length int, contents *[128]coachContent, colour frame.RGB, brightness int) {
	if contents == nil {
		return
	}
	cab, coachW, w := formationDimensions(width, height, length)
	if w == 0 {
		return
	}
	for i := 0; i < min(length, len(contents)); i++ {
		c := contents[i]
		left := x + cab + i*coachW + 1
		interior := board.Clip{X0: left, X1: left + coachW - 1, Y0: y + 1, Y1: y + height - 1}
		if c.loading >= 0 {
			fill := (min(100, c.loading)*(height-2) + 50) / 100
			f.FillRect(left, y+height-1-fill, coachW-1, fill, board.Scale(colour, brightness, 100))
		}
		face := font.InfotecFormation
		board.DrawText(f, face, left+(coachW-1-face.Width(c.text))/2, y+(height-face.Height)/2, c.text, colour, interior)
	}
}
