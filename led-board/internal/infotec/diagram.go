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
	board.DrawText(f, font.PISTall, 3, 8, "Plat", colour, g.full)

	// The number uses the text face at twice its size, omitting the unused descender rows.
	face := font.PISTall
	w, h := 2*face.Width(b.cfg.PlatformBox), 2*face.Baseline
	x := (g.boxW - w) / 2
	top := 8 + face.Baseline + 2
	y := top + (g.sepY-top-h)/2
	for _, r := range b.cfg.PlatformBox {
		glyph := board.GlyphOf(face, r)
		for row, bits := range glyph.Rows[:face.Baseline] {
			for col := range glyph.Width {
				if bits&(1<<col) != 0 {
					f.FillRect(x+2*col, y+2*row, 2, 2, colour)
				}
			}
		}
		x += 2 * (glyph.Width + face.Spacing)
	}
}

// drawFormation draws one outlined carriage per coach, with a sloping cab at the left.
// Long trains use narrower carriages so the complete formation stays on the board.
func drawFormation(f *frame.Frame, x, y, width, height, length int, colour frame.RGB) {
	if length <= 0 || height < 5 || width < 4 || length > (width-1)/3 {
		return
	}
	coachW := min(14, (width-1)/length)
	w := coachW*length + 1
	cab := min(3, coachW-2)
	f.FillRect(x+cab, y, w-cab, 1, colour)
	f.FillRect(x, y+height-1, w, 1, colour)
	for row := range height {
		f.Set(x+cab*(height-1-row)/(height-1), y+row, colour)
	}
	for coach := 1; coach <= length; coach++ {
		f.FillRect(x+coach*coachW, y, 1, height, colour)
	}
}
