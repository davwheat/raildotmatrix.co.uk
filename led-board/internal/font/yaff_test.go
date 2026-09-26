package font

import (
	"strings"
	"testing"
)

func TestYAFFMetricsAndFallback(t *testing.T) {
	text := "yaff: 1.0\nline-height: 4\nascent: 3\nright-bearing: 2\ndefault-char: u+0041\n'A':\n    @.\n    .@\n\n    shift-up: 1\n"
	f, err := loadFace([]byte(text))
	if err != nil {
		t.Fatal(err)
	}
	g := f.Glyphs['A']
	if f.Height != 4 || f.Baseline != 3 || f.Spacing != 2 || g.Width != 2 {
		t.Fatal(f)
	}
	for y, want := range []uint16{1, 2, 0, 0} {
		if g.Rows[y] != want {
			t.Fatalf("row %d: %d, want %d", y, g.Rows[y], want)
		}
	}
	if f.Width("A?") != 6 {
		t.Fatal("fallback or spacing differs")
	}
}

func TestYAFFRejectsUnsupportedBoardGeometry(t *testing.T) {
	header := "yaff: 1.0\nline-height: 4\nascent: 4\nright-bearing: 1\n"
	for _, source := range []string{
		header + "'A':\n    " + strings.Repeat("@", 17),
		header + "'A':\n    @\n\n    shift-up: 4",
		header + "'A':\n    @\n\n    left-bearing: 1",
		header + "'A':\n    @\n\n    right-bearing: 1",
		header + "'ff':\n    @",
		header + "default-char: u+0042\n'A':\n    @",
		header + "levels: 4\n'A':\n    12",
		header + "'A':\n    @\n'A':\n    .",
	} {
		if _, err := loadFace([]byte(source)); err == nil {
			t.Errorf("accepted unsupported font: %s", source)
		}
	}
}
