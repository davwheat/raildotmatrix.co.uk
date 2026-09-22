// Package infotec is the Infotec landscape DMI implementation of board.Board: it turns the live view into
// frames, replaying the web board's layout and animations on a small LED matrix. Everything is integer dot
// arithmetic driven by a fixed-rate Tick, and a tick that changes nothing on screen costs no drawing.
package infotec

import (
	"sync"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Config sizes the board and sets what it shows.
type Config struct {
	Width, Height int
	// Zone is the time zone of the clock and the timetable; nil means UTC.
	Zone *time.Location
	// Colour is the text colour; the zero value means board.Amber.
	Colour frame.RGB
	// ScrollSpeed is how fast text scrolls, in dots per second; 0 means DefaultScrollSpeed.
	ScrollSpeed int
}

// Durations of the animations in board.scss, TrainService.tsx and SwapBetween.tsx, in milliseconds.
const (
	// slideOutDelay is the animation-delay before the outgoing first row starts moving.
	slideOutDelay = 150
	// slideOutTravel is the 28.57% keyframe of the 1400 ms slide-out-to-right animation, when the row has
	// crossed the whole board.
	slideOutTravel = 400
	slideOutTotal  = slideOutDelay + 1400
	// arriveFade is the fade-in of the list, or the no-services message, that follows a slide-out.
	arriveFade   = 500
	swapInterval = 12000
	swapSlide    = 250
	// destinationPage is how long each destination page of a row is shown.
	destinationPage = 3000
	// A cancelled ETD's flash keyframes, which the web plays linearly: it fades out by 50%, back in by 75%, and
	// stays lit for the rest of the cycle.
	flashPeriod = 1500
	flashOut    = 750
	flashIn     = 1125
)

type mode uint8

const (
	modeNoServices mode = iota
	modeWarning
	modeTrains
)

type trainsPhase uint8

const (
	phaseSlideOut trainsPhase = iota
	phaseSteady
)

// fadeLevels is how many brightness steps a fade takes: one per refresh of the half-second arrival fade at the board's
// default 60 Hz.
const fadeLevels = 30

// geometry is the board's layout in dots. Columns follow the CSS grid in trainService.scss with 1ch equal to
// the advance of a digit; rows keep the dot positions measured from the web board, with the clock
// bottom-aligned so it absorbs the shorter panel.
type geometry struct {
	w, h int
	ch   int
	// stdX is the scheduled-time column, and timeW the width of a time drawn in digit cells with a
	// colonCell-wide colon.
	stdX, colonCell, timeW int
	destX, destW           int
	// exptW is the width of the "Expt " label and its spacing, drawn before an expected time.
	exptW int
	// firstY, infoY, sepY and secondY are the cap tops of the rows and the separator's dot row.
	firstY, infoY, sepY, secondY int
	// infoSlide and swapTravel are the 110% and 105% of a row that the information page and the swapped rows
	// travel through.
	infoSlide, swapTravel int
	// lineY holds the cap tops of the three-line message screens.
	lineY                            [3]int
	clockX, clockY, clockCell, colon int
	full                             board.Clip
}

func newGeometry(w, h int) geometry {
	text := font.PISTall
	ch := text.Advance('0')
	// The grid gap is 36 px at 7.17 px per dot.
	gap := 5
	g := geometry{w: w, h: h, ch: ch, full: board.Clip{X1: w, Y1: h}}
	g.stdX = 3*ch + gap
	g.colonCell = ch / 2
	g.timeW = 4*ch + g.colonCell
	g.destX = g.stdX + 9*ch/2 + gap
	g.destW = w - g.destX - gap - 19*ch/2
	g.exptW = text.Width("Expt ") + text.Spacing

	// The web's rows have cap tops at dot rows 0, 17 and 38 with the separator at 33; the panel keeps those
	// and drops the slack above the clock.
	g.firstY = 0
	g.infoY = g.firstY + text.Height + 5
	g.sepY = g.infoY + text.Height + 4
	g.secondY = g.sepY + 5
	g.infoSlide = (text.Height*110 + 50) / 100
	g.swapTravel = (text.Height*105 + 50) / 100

	g.clockY = h - font.DotMatrixClock.Height
	g.clockCell = font.DotMatrixClock.Advance('0')
	// A colon cell is 0.4ch.
	g.colon = (2*g.clockCell + 2) / 5
	g.clockX = (w - 6*g.clockCell - 2*g.colon) / 2

	// The message screens share the space above the clock (less the 24 px gap) equally between three rows and
	// centre a line of text in each.
	band := g.clockY - 3
	for i := range g.lineY {
		g.lineY[i] = (2*band*i + band - 3*text.Height + 3) / 6
	}
	return g
}

// infoBand is the area the information row is clipped to (clip-path: inset(0) in the web).
func (g *geometry) infoBand() board.Clip {
	return board.Clip{X0: 0, Y0: g.infoY, X1: g.w, Y1: g.infoY + font.PISTall.Height}
}

// secondBand is the SwapBetween's 1em overflow box that the 2nd and 3rd rows slide through.
func (g *geometry) secondBand() board.Clip {
	return board.Clip{X0: 0, Y0: g.secondY, X1: g.w, Y1: g.secondY + font.PISTall.Height}
}

// Board is the departure board state machine and renderer. Update may be called from any goroutine; Tick must
// be called from one goroutine only.
type Board struct {
	cfg Config
	geo geometry
	// dim is the separator's colour: the text colour at the separator's 0.5 opacity.
	dim frame.RGB

	mu      sync.Mutex
	pending *model.View

	view    model.View
	content content
	mode    mode

	phase      trainsPhase
	phaseStart time.Time
	// outgoing is the first row sliding off to the right.
	outgoing row
	// fadeInStart is when the current list or message began fading in after a slide-out, or zero when it
	// appeared at once.
	fadeInStart time.Time
	// steadyStart is when the rows appeared, which times the destination pages and the cancelled flash.
	steadyStart time.Time
	info        scroller
	infoPage    int
	// swapIndex selects the 2nd or 3rd train in the lower row; swapFrom is the one it slid away from and
	// swapStart when it did.
	swapIndex, swapFrom int
	swapStart           time.Time

	last  scene
	drawn bool
}

var _ board.Board = (*Board)(nil)

// New returns a board that shows the "listen for announcements" message until it is updated.
func New(cfg Config) *Board {
	if cfg.Zone == nil {
		cfg.Zone = time.UTC
	}
	if cfg.Colour == (frame.RGB{}) {
		cfg.Colour = board.Amber
	}
	if cfg.ScrollSpeed <= 0 {
		cfg.ScrollSpeed = DefaultScrollSpeed
	}
	c := cfg.Colour
	b := &Board{cfg: cfg, geo: newGeometry(cfg.Width, cfg.Height), dim: board.Scale(c, 1, 2)}
	b.info.speed = cfg.ScrollSpeed
	return b
}

// RefreshHz returns the refresh rate at which every scroll step lasts a whole number of refreshes.
func (b *Board) RefreshHz() int { return board.RefreshFor(b.cfg.ScrollSpeed) }

// Update replaces the view. It takes effect on the next Tick, so it is safe to call from another goroutine.
func (b *Board) Update(v model.View) {
	b.mu.Lock()
	b.pending = &v
	b.mu.Unlock()
}

// Tick advances the board to now and, when the picture changed, redraws it into f. It reports whether f
// changed; a caller can skip the panel swap otherwise.
func (b *Board) Tick(now time.Time, f *frame.Frame) bool {
	b.mu.Lock()
	pending := b.pending
	b.pending = nil
	b.mu.Unlock()
	if pending != nil {
		b.apply(*pending, now)
	}
	b.advance(now)

	s := b.compose(now)
	if b.drawn && s == b.last {
		return false
	}
	b.last = s
	b.drawn = true
	b.render(f, &s)
	return true
}

func (b *Board) apply(v model.View, now time.Time) {
	previous := b.content
	b.view = v
	b.content = b.derive(v)
	b.show(b.target(), now, previous)
}

// target is what the view calls for, as FullBoard.tsx picks it.
func (b *Board) target() mode {
	switch {
	case !b.view.Connected:
		return modeNoServices
	case b.view.Notice != model.NoNotice:
		return modeWarning
	case len(b.view.Services) == 0:
		return modeNoServices
	default:
		return modeTrains
	}
}

func (b *Board) show(m mode, now time.Time, previous content) {
	// The last train leaving slides out like any other change of first train, and the no-services message fades
	// in once it has gone. Losing the connection blanks the board at once, as the web does.
	if m == modeNoServices && b.mode == modeTrains && b.view.Connected && len(previous.rows) > 0 {
		b.slideOut(previous.rows[0], now)
		return
	}
	if m != modeTrains {
		b.mode, b.fadeInStart = m, time.Time{}
		return
	}
	// A train arriving on an empty board, or after a warning, appears without an entrance animation.
	if b.mode != modeTrains {
		b.mode, b.fadeInStart = modeTrains, time.Time{}
		b.settle(now)
		return
	}
	if len(previous.rows) > 0 && previous.rows[0].id != b.content.rows[0].id {
		b.slideOut(previous.rows[0], now)
		return
	}
	if b.phase != phaseSteady {
		return
	}
	if !samePages(previous.pages, b.content.pages) {
		b.selectPage(0, now)
	}
	if hasSwap(previous) != hasSwap(b.content) {
		b.swapIndex, b.swapFrom, b.swapStart = 0, 0, now
	}
}

func samePages(a, b []page) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// hasSwap reports whether the lower row alternates between the 2nd and 3rd trains.
func hasSwap(c content) bool { return len(c.rows) >= 3 }

// slideOut starts the outgoing first row's slide unless one is already running, in which case whatever
// follows it is decided when it ends.
func (b *Board) slideOut(outgoing row, now time.Time) {
	if b.phase == phaseSlideOut {
		return
	}
	b.outgoing = outgoing
	b.phase, b.phaseStart = phaseSlideOut, now
}

// settle shows the current rows afresh: every page cycle and swap interval restarts, as the web's components
// remount.
func (b *Board) settle(now time.Time) {
	b.phase, b.phaseStart = phaseSteady, now
	b.steadyStart = now
	b.selectPage(0, now)
	b.swapIndex, b.swapFrom, b.swapStart = 0, 0, now
}

func (b *Board) selectPage(i int, now time.Time) {
	b.infoPage = i
	if i < len(b.content.pages) {
		b.info.reset(b.content.pages[i], &b.geo, now)
	}
}

func (b *Board) advance(now time.Time) {
	if b.mode != modeTrains {
		return
	}
	if b.phase == phaseSlideOut {
		if now.Sub(b.phaseStart).Milliseconds() < slideOutTotal {
			return
		}
		end := b.phaseStart.Add(slideOutTotal * time.Millisecond)
		b.fadeInStart = end
		if len(b.content.rows) == 0 {
			b.mode = modeNoServices
			return
		}
		b.settle(end)
	}
	// A completed page hands over to the next at the instant it finished, so the cycle never drifts. With a
	// single page the web parks a scrolled text off screen for good; restarting it is the deliberate departure.
	if len(b.content.pages) > 0 && b.info.advance(now) {
		b.selectPage((b.infoPage+1)%len(b.content.pages), b.info.start)
		b.info.advance(now)
	}
	if hasSwap(b.content) && now.Sub(b.swapStart).Milliseconds() >= swapInterval {
		b.swapFrom, b.swapIndex = b.swapIndex, b.swapIndex^1
		b.swapStart = b.swapStart.Add(swapInterval * time.Millisecond)
	}
}
