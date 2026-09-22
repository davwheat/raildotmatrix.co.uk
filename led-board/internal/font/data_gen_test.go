package font

import "testing"

func TestTextWidth(t *testing.T) {
	// '1' is 3 dots wide and the other digits 5, each followed by 1 dot of spacing.
	if got, want := Text.Width("1943"), 3+1+5+1+5+1+5; got != want {
		t.Errorf("Text.Width(\"1943\") = %d, want %d", got, want)
	}
	if got := Text.Width(""); got != 0 {
		t.Errorf("Text.Width(\"\") = %d, want 0", got)
	}
	// The Infotec clock face has 8-dot digits, except a 4-dot '1' and a 6-dot '4', and 2-dot colons.
	if got, want := DotMatrixClock.Width("19:40:00"), 4+1+8+1+2+1+6+1+8+1+2+1+8+1+8; got != want {
		t.Errorf("DotMatrixClock.Width(\"19:40:00\") = %d, want %d", got, want)
	}
}

// None of the faces is fully tabular: '1' is narrower than the other digits in all of them, and the Infotec clock
// also narrows '4'. The boards hide this in clocks and times by centring each digit in a fixed 1ch cell, as the
// web boards do; elsewhere digits show as drawn.
func TestDigitWidths(t *testing.T) {
	cases := []struct {
		name   string
		face   *Face
		wide   int
		narrow map[rune]int
	}{
		{"Text", Text, 5, map[rune]int{'1': 3}},
		{"Clock", Clock, 7, map[rune]int{'1': 6}},
		{"PISTall", PISTall, 5, map[rune]int{'1': 3}},
		{"InfotecLarge", InfotecLarge, 9, map[rune]int{'1': 4}},
		{"DotMatrixClock", DotMatrixClock, 8, map[rune]int{'1': 4, '4': 6}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for r := '0'; r <= '9'; r++ {
				want := tc.wide
				if w, ok := tc.narrow[r]; ok {
					want = w
				}
				g, ok := tc.face.Glyphs[r]
				if !ok {
					t.Fatalf("missing glyph %q", r)
				}
				if g.Width != want {
					t.Errorf("%q width = %d, want %d", r, g.Width, want)
				}
			}
		})
	}
}

func TestFaceGeometry(t *testing.T) {
	cases := []struct {
		name             string
		face             *Face
		height, baseline int
		spacing, colon   int
		space            int
	}{
		{"Text", Text, 7, 6, 1, 1, 4},
		{"Clock", Clock, 7, 7, 1, 2, 3},
		{"PISTall", PISTall, 12, 9, 1, 1, 4},
		{"DotMatrixClock", DotMatrixClock, 9, 7, 1, 2, -1},
		{"InfotecLarge", InfotecLarge, 11, 11, 2, 2, -1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := tc.face
			if f.Height != tc.height || f.Baseline != tc.baseline || f.Spacing != tc.spacing {
				t.Errorf("Height/Baseline/Spacing = %d/%d/%d, want %d/%d/%d",
					f.Height, f.Baseline, f.Spacing, tc.height, tc.baseline, tc.spacing)
			}
			if g := f.Glyphs[':']; g.Width != tc.colon {
				t.Errorf("colon width = %d, want %d", g.Width, tc.colon)
			}
			if g, ok := f.Glyphs[' ']; ok != (tc.space >= 0) || (ok && g.Width != tc.space) {
				t.Errorf("space width = %d (present %t), want %d", g.Width, ok, tc.space)
			}
			for r, g := range f.Glyphs {
				if len(g.Rows) != f.Height {
					t.Errorf("%q has %d rows, want %d", r, len(g.Rows), f.Height)
				}
				for i, row := range g.Rows {
					if row>>g.Width != 0 {
						t.Errorf("%q row %d has dots beyond its width %d", r, i, g.Width)
					}
				}
			}
			if len(f.Fallback.Rows) != f.Height || f.Fallback.Width == 0 {
				t.Errorf("fallback glyph is %dx%d", f.Fallback.Width, len(f.Fallback.Rows))
			}
		})
	}
}

func TestCoverage(t *testing.T) {
	for r := rune(' '); r <= '~'; r++ {
		if _, ok := Text.Glyphs[r]; !ok {
			t.Errorf("Text lacks %q", r)
		}
	}
	for _, r := range "×÷‘’“”…" {
		if _, ok := Text.Glyphs[r]; !ok {
			t.Errorf("Text lacks %q", r)
		}
	}
	for _, r := range "0123456789: " {
		if _, ok := Clock.Glyphs[r]; !ok {
			t.Errorf("Clock lacks %q", r)
		}
	}
	// The PIS Tall font has no '$' or '`'.
	for r := rune(' '); r <= '~'; r++ {
		if _, ok := PISTall.Glyphs[r]; !ok && r != '$' && r != '`' {
			t.Errorf("PISTall lacks %q", r)
		}
	}
	for _, r := range "0123456789:" {
		if _, ok := DotMatrixClock.Glyphs[r]; !ok {
			t.Errorf("DotMatrixClock lacks %q", r)
		}
	}
	// The Infotec clock only ever shows digits and colons, so the face is trimmed to them.
	if n := len(DotMatrixClock.Glyphs); n != 11 {
		t.Errorf("DotMatrixClock has %d glyphs, want 11", n)
	}
}

func TestGlyphShapes(t *testing.T) {
	// Row bits are little-endian: bit 0 is the leftmost dot, so these literals read mirrored.
	cases := []struct {
		name string
		face *Face
		want map[rune][]uint16
	}{
		{"Text", Text, map[rune][]uint16{
			'1': {0b010, 0b011, 0b010, 0b010, 0b010, 0b111, 0b000},
			'g': {0b00000, 0b01110, 0b10001, 0b10001, 0b11110, 0b10000, 0b01110},
		}},
		{"PISTall", PISTall, map[rune][]uint16{
			'1': {0b010, 0b011, 0b010, 0b010, 0b010, 0b010, 0b010, 0b010, 0b111, 0b000, 0b000, 0b000},
			':': {0b0, 0b0, 0b0, 0b1, 0b0, 0b0, 0b0, 0b1, 0b0, 0b0, 0b0, 0b0},
		}},
		{"DotMatrixClock", DotMatrixClock, map[rune][]uint16{
			'1': {0b0110, 0b0111, 0b0110, 0b0110, 0b0110, 0b0110, 0b0110, 0b0110, 0b1111},
			':': {0b00, 0b00, 0b11, 0b11, 0b00, 0b11, 0b11, 0b00, 0b00},
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for r, rows := range tc.want {
				g := tc.face.Glyphs[r]
				if len(g.Rows) != len(rows) {
					t.Fatalf("%q has %d rows, want %d", r, len(g.Rows), len(rows))
				}
				for i := range rows {
					if g.Rows[i] != rows[i] {
						t.Errorf("%q row %d = %0*b, want %0*b", r, i, g.Width, g.Rows[i], g.Width, rows[i])
					}
				}
			}
		})
	}
}
