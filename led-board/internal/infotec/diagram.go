package infotec

import (
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func (b *Board) drawPlatformBox(f *frame.Frame, colour frame.RGB) {
	g := &b.geo
	f.FillRect(0, 0, g.boxW, 1, colour)
	f.FillRect(0, 0, 1, g.sepY+1, colour)
	f.FillRect(g.boxW-1, 0, 1, g.sepY+1, colour)
	f.FillRect(0, g.sepY, g.boxW, 1, colour)
	// Centre the label and number as a group, two dots above the box's centre.
	const gap = 6
	height := font.PISTall.Baseline + gap + font.InfotecLarge.Height
	y := max(1, (g.sepY-height)/2-2)
	board.DrawText(f, font.PISTall, (g.boxW-font.PISTall.Width("Plat"))/2, y, "Plat", colour, g.full)
	board.DrawText(f, font.InfotecLarge, (g.boxW-font.InfotecLarge.Width(b.cfg.PlatformBox))/2, y+font.PISTall.Baseline+gap, b.cfg.PlatformBox, colour, g.full)
}

// drawFormation draws outlined coaches with a filled, stepped cab and a rounded last coach.
// Long trains use narrower carriages so the complete formation stays on the board.
func drawFormation(f *frame.Frame, x, y, width, height, length int, colour frame.RGB) {
	if length <= 0 || height < 5 || width < 4 || length > (width-1)/3 {
		return
	}
	// The nose slopes by one dot every two rows, almost down to the floor.
	// Reserve it ahead of the coaches so every hollow body has the same width.
	cab := min((height-2)/2, width-1-3*length)
	coachW := min(14, (width-cab-1)/length)
	w := cab + coachW*length + 1
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
	// Remove the corner dots of the last coach and round the cab's lower edge.
	f.Set(x, y+height-1, frame.Black)
	edges := []int{x + w - 1}
	if length > 1 {
		edges = append(edges, x+cab+(length-1)*coachW)
	}
	for _, edge := range edges {
		f.Set(edge, y, frame.Black)
		f.Set(edge, y+height-1, frame.Black)
	}
}
