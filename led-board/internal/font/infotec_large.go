package font

import "strings"

// InfotecLarge is the eleven-row numeral face used by Infotec platform boxes and
// clocks. The reference display has two-dot vertical strokes, one-dot horizontal
// strokes, rounded bowls, and a diagonal 2. These are native dot patterns, not
// scaled versions of the smaller information font.
var InfotecLarge = newInfotecLarge()

func newInfotecLarge() *Face {
	f := &Face{Height: 11, Baseline: 11, Spacing: 2, Glyphs: map[rune]Glyph{}}
	// Patterns read left to right, unlike the little-endian bit rows in Glyph.
	for r, pattern := range map[rune]string{
		'0': `..#####..
              .##...##.
              ##.....##
              ##.....##
              ##.....##
              ##.....##
              ##.....##
              ##.....##
              ##.....##
              .##...##.
              ..#####..`,
		'1': `..##
              ..##
              ####
              ..##
              ..##
              ..##
              ..##
              ..##
              ..##
              ..##
              ..##`,
		'2': `.######..
              ##.....##
              .......##
              .......##
              ......##.
              .....##..
              ....##...
              ...##....
              ..##.....
              .##......
              #########`,
		'3': `.######..
              ##.....##
              .......##
              .......##
              ......##.
              ..#####..
              ......##.
              .......##
              .......##
              ##.....##
              .######..`,
		'4': `.....##..
              ....###..
              ...####..
              ..##.##..
              .##..##..
              ##...##..
              ##...##..
              #########
              .....##..
              .....##..
              .....##..`,
		'5': `#########
              ##.......
              ##.......
              ##.......
              #######..
              .......##
              .......##
              .......##
              .......##
              ##.....##
              .######..`,
		'6': `..#####..
              .##....##
              ##.......
              ##.......
              ##.......
              #######..
              ##.....##
              ##.....##
              ##.....##
              .##...##.
              ..#####..`,
		'7': `#########
              .......##
              ......##.
              .....##..
              ....##...
              ...##....
              ..##.....
              ..##.....
              ..##.....
              ..##.....
              ..##.....`,
		'8': `..#####..
              .##...##.
              ##.....##
              ##.....##
              .##...##.
              ..#####..
              .##...##.
              ##.....##
              ##.....##
              .##...##.
              ..#####..`,
		'9': `..#####..
              .##...##.
              ##.....##
              ##.....##
              ##.....##
              .########
              .......##
              .......##
              .......##
              ##....##.
              .######..`,
		':': `..
              ..
              ..
              ##
              ##
              ..
              ..
              ##
              ##
              ..
              ..`,
	} {
		rows := strings.Fields(pattern)
		g := Glyph{Width: len(rows[0]), Rows: make([]uint16, len(rows))}
		for y, row := range rows {
			for x, dot := range row {
				if dot == '#' {
					g.Rows[y] |= 1 << x
				}
			}
		}
		f.Glyphs[r] = g
	}
	// Keep platform suffixes such as 10A in the normal lettering, centred
	// vertically alongside the numerals.
	for _, r := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ?" {
		source := PISTall.Glyphs[r]
		g := Glyph{Width: source.Width, Rows: make([]uint16, f.Height)}
		copy(g.Rows[1:], source.Rows[:PISTall.Baseline])
		f.Glyphs[r] = g
	}
	f.Fallback = f.Glyphs['?']
	return f
}
