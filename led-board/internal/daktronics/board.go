// Package daktronics is the Data Display DMI implementation of board.Board: it turns the live view into
// frames, replaying the web board's layout and animations on a small LED matrix. Everything is integer dot
// arithmetic driven by a fixed-rate Tick, and a tick that changes nothing on screen costs no drawing.
package daktronics

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
	OrdinalFormat board.OrdinalFormat
	Width, Height int
	// Zone is the time zone of the clock and the timetable; nil means UTC.
	Zone *time.Location
	// WorldlinePowered selects the variant that folds the information row into one scrolling sentence and
	// capitalises destinations.
	WorldlinePowered bool
	// Colour is the text colour; the zero value means board.Amber.
	Colour frame.RGB
	// ScrollSpeed is how fast text scrolls, in dots per second; 0 means DefaultScrollSpeed.
	ScrollSpeed int
	// RowPrefix selects ordinals or platform numbers before each train's time.
	RowPrefix board.RowPrefix
	// WarningPlatform names the platform in a warning, in place of "this station", when the warning is for one
	// platform.
	WarningPlatform bool
}

// Durations of the animations in TrainServices.tsx, PlatformAlterationMessage.tsx and SwapBetween.tsx, in
// milliseconds.
const (
	// clearDownDelay is the animation-delay before the wipe starts, during which the old row stands still.
	clearDownDelay = 150
	// clearDownWipe is the 75% keyframe of the 3500 ms clip animation, when the wipe reaches the far edge.
	clearDownWipe  = 2625
	clearDownTotal = clearDownDelay + 3500
	// clearDownSpinnerLag is how far behind the wipe the spinner glyph runs: its animation starts 100 ms later.
	clearDownSpinnerLag = 100
	// clearDownOverrun is the 100 px the wipe travels past the board's edge, in dots.
	clearDownOverrun = 9
	spinnerFlip      = 100
	slideInDuration  = 1600
	rowSlideDuration = 400
	swapInterval     = 12000
	destinationPage  = 3000
	alterationFlash  = 1000
	alterationTotal  = 6 * alterationFlash
)

type mode uint8

const (
	modeNoServices mode = iota
	modeWarning
	modeAlteration
	modeTrains
)

type trainsPhase uint8

const (
	phaseClearDown trainsPhase = iota
	phaseSlideIn
	phaseSteady
)

// geometry is the board's layout in dots. Columns follow the CSS grid in TrainService.tsx with 1ch equal to
// the advance of a digit; rows are a quarter of the height each.
type geometry struct {
	w, h  int
	rowH  int
	pad   int
	bandH int
	// prefixW reserves one column for either ordinals or platform numbers.
	prefixW int
	stdX    int
	destX   int
	destW   int
	etdW    int
	ch      int
	clockX  int
	cell    int
}

func newGeometry(w, h int, prefix board.RowPrefix) geometry {
	ch := font.Text.Advance('0')
	// The grid gap is 1em/7*2.5 = 1.25 dots; the column widths are 3.25ch, 4.5ch and 8.2ch.
	gap := 1
	ordinalW := (13*ch + 2) / 4
	stdW := 9 * ch / 2
	g := geometry{w: w, h: h, rowH: h / 4, ch: ch, cell: font.Clock.Advance('0')}
	x := 0
	column := func(width int) int {
		at := x
		x += width + gap
		return at
	}
	g.prefixW = ordinalW
	if prefix == board.PrefixPlatforms {
		g.prefixW = board.PlatformWidth(font.Text)
	}
	column(g.prefixW)
	g.stdX = column(stdW)
	g.destX = x
	g.etdW = (41*ch + 2) / 5
	g.destW = w - g.destX - gap - g.etdW
	// The web puts cap tops at the row top and clips each row at 80% of its height; in the panel's taller rows
	// the text sits a little below the top, and a row's animations are clipped to a band that ends two dots
	// short of the next row.
	g.pad = max((g.rowH-font.Text.Height)/2-1, 0)
	g.bandH = g.rowH - 2
	g.clockX = (w - 8*g.cell) / 2
	return g
}

func (g *geometry) rowTop(i int) int { return i * g.rowH }

func (g *geometry) textY(i int) int { return g.rowTop(i) + g.pad }

// band is the area of row i that animated text is visible in.
func (g *geometry) band(i int) board.Clip {
	return board.Clip{X0: 0, Y0: g.textY(i), X1: g.w, Y1: g.rowTop(i) + g.bandH}
}

// Board is the departure board state machine and renderer. Update may be called from any goroutine; Tick must
// be called from one goroutine only.
type Board struct {
	cfg Config
	geo geometry

	mu      sync.Mutex
	pending *model.View

	view    model.View
	content content
	mode    mode
	// modeStart is when the current mode began, which times the platform alteration flash.
	modeStart time.Time

	phase      trainsPhase
	phaseStart time.Time
	// outgoing is the first row being wiped by the clear-down.
	outgoing row
	// steadyStart is when the rows settled after the entrance, which times the destination page cycling.
	steadyStart time.Time
	info        scroller
	infoPage    int
	// swapIndex selects the 2nd or 3rd train for the third row; swapStart is when it last changed and
	// rowSlideStart when the third row last slid up.
	swapIndex     int
	swapStart     time.Time
	rowSlideStart time.Time

	clock clock
	last  scene
	drawn bool
}

var _ board.Board = (*Board)(nil)

// New returns a board that shows the "not connected" state until it is updated.
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
	b := &Board{cfg: cfg, geo: newGeometry(cfg.Width, cfg.Height, cfg.RowPrefix)}
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
	b.clock.update(now, clockDigits(now, b.cfg.Zone))

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
	warning := v.Notice != model.NoNotice
	previous := b.content
	b.view = v
	b.content = b.derive(v)

	// A stand clear warning replaces an alteration outright; the train it describes is passing the platform
	// now, and by the time the warning clears the altered train has long gone.
	if len(v.Alterations) > 0 && !warning && b.mode != modeAlteration {
		b.mode, b.modeStart = modeAlteration, now
		return
	}
	if b.mode == modeAlteration && !warning {
		return
	}
	b.show(b.target(), now, previous)
}

// target is what the view calls for once any announcement is over.
func (b *Board) target() mode {
	switch {
	case !b.view.Connected:
		return modeNoServices
	case len(b.view.Services) == 0 && b.view.Notice == model.NoNotice:
		return modeNoServices
	case b.view.Notice != model.NoNotice:
		return modeWarning
	default:
		return modeTrains
	}
}

func (b *Board) show(m mode, now time.Time, previous content) {
	// The last train leaving clears down like any other change of first train; the no-services message
	// waits until the wipe has finished. Losing the connection blanks the board at once, as the web does.
	if m == modeNoServices && b.mode == modeTrains && b.view.Connected && len(previous.rows) > 0 {
		b.clearDown(previous.rows[0], now)
		return
	}
	if m != modeTrains {
		b.mode, b.modeStart = m, now
		return
	}
	if b.mode != modeTrains {
		b.mode, b.modeStart = modeTrains, now
		b.enter(now)
		return
	}
	if len(previous.rows) > 0 && previous.rows[0].id != b.content.rows[0].id {
		b.clearDown(previous.rows[0], now)
		return
	}
	if b.phase != phaseSteady {
		return
	}
	if !samePages(previous.pages, b.content.pages) {
		b.infoPage = 0
		b.info.reset(b.content.pages[0], b.geo.w, now)
	}
	if thirdRowCount(previous) != thirdRowCount(b.content) {
		b.swapIndex, b.swapStart, b.rowSlideStart = 0, now, now
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

// thirdRowCount is how many trains the third row cycles through: the 2nd and 3rd, unless either divides,
// in which case the 2nd alone, cycling its destinations. (TrainServices.tsx leaves the row empty when the 2nd
// train divides; showing it is the deliberate departure.)
func thirdRowCount(c content) int {
	switch {
	case len(c.rows) < 2:
		return 0
	case len(c.rows) < 3, c.rows[1].dividing, c.rows[2].dividing:
		return 1
	default:
		return 2
	}
}

// clearDown wipes the outgoing first row unless a wipe is already running, in which case whatever follows it
// is decided when it ends.
func (b *Board) clearDown(outgoing row, now time.Time) {
	if b.phase == phaseClearDown {
		return
	}
	b.outgoing = outgoing
	b.phase, b.phaseStart = phaseClearDown, now
}

// enter starts the entrance animation: the first train slides up from the bottom of the board.
func (b *Board) enter(now time.Time) {
	b.phase, b.phaseStart = phaseSlideIn, now
}

func (b *Board) settle(now time.Time) {
	b.phase, b.phaseStart = phaseSteady, now
	b.steadyStart = now
	b.infoPage = 0
	if len(b.content.pages) > 0 {
		b.info.reset(b.content.pages[0], b.geo.w, now)
	}
	b.swapIndex, b.swapStart, b.rowSlideStart = 0, now, now
}

func (b *Board) advance(now time.Time) {
	if b.mode == modeAlteration && now.Sub(b.modeStart).Milliseconds() >= alterationTotal {
		b.mode, b.modeStart = b.target(), now
		if b.mode == modeTrains {
			b.enter(now)
		}
	}
	if b.mode != modeTrains {
		return
	}
	switch b.phase {
	case phaseClearDown:
		if now.Sub(b.phaseStart).Milliseconds() >= clearDownTotal {
			end := b.phaseStart.Add(clearDownTotal * time.Millisecond)
			if len(b.content.rows) == 0 {
				b.mode, b.modeStart = modeNoServices, end
				return
			}
			b.enter(end)
		}
	case phaseSlideIn:
		if now.Sub(b.phaseStart).Milliseconds() >= slideInDuration {
			b.settle(b.phaseStart.Add(slideInDuration * time.Millisecond))
		}
	}
	if b.phase != phaseSteady {
		return
	}
	if len(b.content.pages) > 0 && b.info.advance(now) {
		b.infoPage = (b.infoPage + 1) % len(b.content.pages)
		b.info.reset(b.content.pages[b.infoPage], b.geo.w, b.info.start)
		b.info.advance(now)
	}
	if thirdRowCount(b.content) == 2 && now.Sub(b.swapStart).Milliseconds() >= swapInterval {
		b.swapIndex ^= 1
		b.swapStart = b.swapStart.Add(swapInterval * time.Millisecond)
		b.rowSlideStart = b.swapStart
	}
}
