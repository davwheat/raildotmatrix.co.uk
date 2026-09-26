package board

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestTextRunMatchesDrawText(t *testing.T) {
	rng := rand.New(rand.NewPCG(17, 31))
	faces := []*font.Face{font.Text, font.PISTall, font.InfotecSmall, font.InfotecFormation}
	texts := []string{"", "Calling at: ", "Clapham Junction, East Croydon and Brighton", "A § ± € # 1st → 未知", "invalid \xff\xfe UTF-8", strings.Repeat("Station, ", 500), strings.Repeat("Station, ", 600)}
	var run TextRun
	got, want := frame.New(89, 27), frame.New(89, 27)
	for step := range 5000 {
		face, text := faces[rng.IntN(len(faces))], texts[rng.IntN(len(texts))]
		x, y := 100-rng.IntN(max(1, face.Width(text)+200)), rng.IntN(65)-30
		clip := Clip{rng.IntN(100) - 20, rng.IntN(35) - 10, rng.IntN(120), rng.IntN(40)}
		colour := frame.RGB{R: uint8(rng.Uint32()), G: uint8(rng.Uint32()), B: uint8(rng.Uint32())}
		// Keep the prior pixels to detect accidental clearing as well as dots.
		end := run.Draw(got, face, x, y, text, colour, clip)
		if end != DrawText(want, face, x, y, text, colour, clip) || !got.Equal(want) {
			t.Fatalf("step %d: cached text differs at %d,%d in %+v", step, x, y, clip)
		}
		if cap(run.points) > maxCachedTextBytes {
			t.Fatalf("retained layout exceeds its bound: %d points", cap(run.points))
		}
	}
}
