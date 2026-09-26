package board

import (
	"strings"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/font"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func TestTextTilesClipsAndEviction(t *testing.T) {
	text := strings.Repeat("Clapham Junction, East Croydon; ", 90)
	var run TextRun
	used := false
	for _, face := range []*font.Face{font.Text, font.PISTall, font.InfotecSmall, font.InfotecFormation} {
		for _, width := range []int{1, 63, 64, 65, 256, 511, 512, 513, 900} {
			got, want := frame.New(width, 41), frame.New(width, 41)
			for _, x := range []int{-20000, -4096, -1025, -513, -512, -511, -129, -65, -64, -63, -1, 0, 63, 64, 255, 256} {
				for _, clip := range []Clip{{0, 0, width, 41}, {width / 3, 5, width - 1, 25}} {
					for repeat := range 3 {
						colour := frame.RGB{R: uint8(30 + repeat*80), G: 111, B: 57}
						got.Clear()
						want.Clear()
						actual := run.Draw(got, face, x, 3, text, colour, clip)
						expected := DrawText(want, face, x, 3, text, colour, clip)
						if actual != expected || !got.Equal(want) {
							t.Fatalf("width=%d x=%d clip=%+v repeat=%d", width, x, clip, repeat)
						}
						for _, tag := range run.tileTags {
							used = used || run.tileHeight > 0 && tag >= 0
						}
						if cap(run.tiles) > maxTextTileWords {
							t.Fatal("tile storage exceeded bound")
						}
					}
				}
			}
		}
	}
	if !used {
		t.Fatal("test never exercised the tile cache")
	}
}
