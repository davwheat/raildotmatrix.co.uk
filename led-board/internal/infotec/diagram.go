package infotec

import (
	"unicode/utf8"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func platformBoxStyle(platform string) (face font.Face, padding int) {
	face, padding = *font.InfotecPlatform, 4
	if utf8.RuneCountInString(platform) == 3 {
		face.Spacing--
		padding = 3
	}
	return
}

// Keep the departing train's platform until its slide finishes, just like its
// time and destination. Empty means unknown or suppressed by the public feed.
func (b *Board) platformBox() string {
	if !b.cfg.ServicePlatformBox {
		return b.cfg.PlatformBox
	}
	if b.phase == phaseSlideOut {
		return b.outgoing.platform
	}
	if len(b.content.rows) > 0 {
		return b.content.rows[0].platform
	}
	return ""
}

func (b *Board) drawPlatformBox(f *frame.Frame, colour frame.RGB) {
	g := &b.geo
	platform := b.platformBox()
	text, _ := platformBoxStyle(platform)
	f.FillRect(0, 0, g.boxW, 1, colour)
	f.FillRect(0, 0, 1, g.sepY+1, colour)
	f.FillRect(g.boxW-1, 0, 1, g.sepY+1, colour)
	f.FillRect(0, g.sepY, g.boxW, 1, colour)
	// Centre the label and number as a group between the top and bottom borders.
	const gap = 6
	height := font.PISTall.Baseline + gap + font.InfotecPlatform.Height
	y := max(1, 1+(g.sepY-1-height)/2)
	board.DrawText(f, font.PISTall, (g.boxW-font.PISTall.Width("Plat"))/2, y, "Plat", colour, g.full)
	// Round half-dot positions to the right so odd-width numbers do not sit left of centre.
	numberX := (g.boxW - text.Width(platform) + 1) / 2
	board.DrawText(f, &text, numberX, y+font.PISTall.Baseline+gap, platform, colour, g.full)
}

// formationDimensions narrows long trains so the complete formation stays on the board.
func formationDimensions(width, height, length int) (cab, coachW, w int) {
	if length <= 0 || height < 5 || width < 4 || length > (width-1)/3 {
		return
	}
	// The nose slopes by one dot every two rows, almost down to the floor.
	// Reserve it ahead of the coaches so every hollow body has the same width.
	cab = min((height-2)/2, width-1-3*length)
	coachW = min(14, (width-cab-1)/length)
	w = cab + coachW*length + 1
	return
}

// drawFormation draws outlined coaches with a filled, stepped cab and a rounded last coach.
func drawFormation(f *frame.Frame, x, y, width, height, length int, colour frame.RGB) {
	cab, coachW, w := formationDimensions(width, height, length)
	if w == 0 {
		return
	}
	f.FillRect(x+cab, y, w-cab, 1, colour)
	f.FillRect(x, y+height-1, w, 1, colour)
	for row := range height {
		left := min(cab, max(0, (height-2)/2-row/2))
		if row == height-1 {
			left = 1
		}
		f.FillRect(x+left, y+row, cab-left+1, 1, colour)
	}
	for coach := 1; coach <= length; coach++ {
		f.FillRect(x+cab+coach*coachW, y, 1, height, colour)
	}
	// Round only the rear end and the cab's lower edge; shared coach dividers
	// meet the roof and floor without gaps.
	f.Set(x, y+height-1, frame.Black)
	f.Set(x+w-1, y, frame.Black)
	f.Set(x+w-1, y+height-1, frame.Black)
}
