package infotec

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// ValidateFormationCount accepts an empty value as the default of no label.
func ValidateFormationCount(style string) error {
	switch style {
	case "", "none", "number", "coaches", "coaches-no-brackets", "carriages", "carriages-no-brackets":
		return nil
	}
	return fmt.Errorf("formation count must be none, number, coaches, coaches-no-brackets, carriages or carriages-no-brackets")
}

const formationCountGap = 4

// Keep the usual coach widths wherever possible. Long trains reserve enough
// room for the numeric label; wording only uses space left beside the graphic.
func formationCountLayout(width, height, length int, style string) (diagramWidth int, label string) {
	_, _, diagramWidth = formationDimensions(width, height, length)
	if diagramWidth == 0 || style == "" || style == "none" {
		return
	}
	face := font.InfotecSmall
	number := strconv.Itoa(length)
	numeric := "(" + number + ")"
	_, _, labelledWidth := formationDimensions(width-formationCountGap-face.Width(numeric), height, length)
	if labelledWidth == 0 {
		return // Even the minimum coach widths cannot leave room for a count.
	}
	diagramWidth, label = labelledWidth, numeric
	unit, noBrackets := strings.CutSuffix(style, "-no-brackets")
	if unit == "coaches" || unit == "carriages" {
		full := number + " " + unit
		if !noBrackets {
			full = "(" + full + ")"
		}
		if diagramWidth+formationCountGap+face.Width(full) <= width {
			label = full
		}
	}
	return
}

func (b *Board) drawTrainFormation(f *frame.Frame, s *scene, colour frame.RGB) {
	g := &b.geo
	width, label := formationCountLayout(g.w-g.infoX, g.formationH, s.formation, b.cfg.FormationCount)
	drawFormation(f, g.infoX, g.formationY, width, g.formationH, s.formation, colour)
	drawFormationContents(f, g.infoX, g.formationY, width, g.formationH, s.formation, s.coachContents, colour, b.cfg.LoadingBrightness)
	if label == "" {
		return
	}
	face := font.InfotecSmall
	// Align the last lit row, including the descender in "carriages", rather
	// than the font's bounding box, which has blank rows below most letters.
	bottom := 0
	for _, r := range label {
		for row, bits := range board.GlyphOf(face, r).Rows {
			if bits != 0 {
				bottom = max(bottom, row+1)
			}
		}
	}
	clip := board.Clip{X0: g.infoX, Y0: g.formationY, X1: g.w, Y1: g.formationY + g.formationH}
	board.DrawText(f, face, g.infoX+width+formationCountGap, clip.Y1-bottom, label, colour, clip)
}
