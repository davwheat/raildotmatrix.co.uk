package infotec

import (
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
	"time"
)

type coachContent struct {
	text    string
	loading int
}

// Shared five-second slots show identifiers, loading, then facilities. Extra
// facility slots repeat accessibility first, then cycles, then first class.
func formationContents(coaches []model.Coach, elapsed time.Duration) (out [128]coachContent) {
	labels, loads, facilities := false, false, 0
	for _, c := range coaches {
		labels = labels || c.Label != ""
		loads = loads || c.Loading >= 0
		facilities = max(facilities, len(coachFacilities(c)))
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
		options := coachFacilities(c)
		if len(options) != 0 {
			out[i].text = options[max(0, page-(facilities-len(options)))]
		}
	}
	return
}

func coachFacilities(c model.Coach) []string {
	var options []string
	if c.Accessible {
		options = append(options, "§")
	}
	if c.Cycles {
		options = append(options, "#")
	}
	if c.FirstClass {
		options = append(options, "1st")
	}
	return options
}

func drawFormationContents(f *frame.Frame, x, y, width, height, length int, contents [128]coachContent, colour frame.RGB) {
	if length <= 0 || height < 5 || width < 4 || length > (width-1)/3 {
		return
	}
	cab := min((height-2)/2, width-1-3*length)
	coachW := min(14, (width-cab-1)/length)
	for i := 0; i < min(length, len(contents)); i++ {
		c := contents[i]
		left := x + cab + i*coachW + 1
		interior := board.Clip{X0: left, X1: left + coachW - 1, Y0: y + 1, Y1: y + height - 1}
		if c.loading >= 0 {
			fill := (min(100, c.loading)*(height-2) + 50) / 100
			f.FillRect(left, y+height-1-fill, coachW-1, fill, board.Scale(colour, 1, 2))
		}
		face := font.InfotecFormation
		board.DrawText(f, face, left+(coachW-1-face.Width(c.text))/2, y+(height-face.Height)/2, c.text, colour, interior)
	}
}
