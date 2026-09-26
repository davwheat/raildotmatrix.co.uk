package font

import (
	"embed"
	"fmt"
	"strconv"
	"unicode/utf8"

	"github.com/davwheat/yaff-go"
)

//go:embed fonts/*.yaff
var sources embed.FS

var (
	Text              = mustLoadFace("data-display-text")
	Clock             = mustLoadFace("data-display-clock")
	PISTall           = mustLoadFace("pis-tall")
	DotMatrixClock    = mustLoadFace("dot-matrix-clock")
	InfotecLarge      = mustLoadFace("infotec-large")
	InfotecPlatform   = mustLoadFace("infotec-platform")
	InfotecSmall      = mustLoadFace("infotec-small")
	InfotecFormation  = mustLoadFace("infotec-formation")
	InfotecClock      = mustLoadFace("infotec-clock")
	InfotecSmallClock = mustLoadFace("infotec-small-clock")
)

func mustLoadFace(name string) *Face {
	data, err := sources.ReadFile("fonts/" + name + ".yaff")
	if err != nil {
		panic(err)
	}
	f, err := loadFace(data)
	if err != nil {
		panic(fmt.Errorf("font %s: %w", name, err))
	}
	return f
}

// loadFace adapts YAFF to the board's fixed-height, monochrome, single-rune
// renderer. The standalone parser handles the complete YAFF syntax. This adapter
// rejects geometry that the renderer cannot represent instead of dropping it.
func loadFace(data []byte) (*Face, error) {
	source, err := yaff.ParseBytes(data)
	if err != nil {
		return nil, err
	}
	if source.Levels != 2 {
		return nil, fmt.Errorf("board fonts require monochrome pixels")
	}
	integer := func(key string, required bool) (int, error) {
		value := source.Properties.Get(key)
		if value == "" && !required {
			return 0, nil
		}
		n, err := strconv.Atoi(value)
		if err != nil {
			return 0, fmt.Errorf("invalid %s: %q", key, value)
		}
		return n, nil
	}
	height, err := integer("line-height", true)
	if err != nil {
		return nil, err
	}
	baseline, err := integer("ascent", true)
	if err != nil {
		return nil, err
	}
	spacing, err := integer("right-bearing", false)
	if err != nil {
		return nil, err
	}
	if height <= 0 || height > 256 || baseline < 0 || baseline > height || spacing < 0 {
		return nil, fmt.Errorf("invalid face geometry")
	}
	f := &Face{Height: height, Baseline: baseline, Spacing: spacing, Glyphs: map[rune]Glyph{}}
	defaultLabel, hasDefault, err := source.DefaultChar()
	if err != nil {
		return nil, err
	}
	defaultFound := false
	for _, glyph := range source.Glyphs {
		left, err := source.Metric(glyph, "left-bearing")
		if err != nil {
			return nil, err
		}
		right, err := source.Metric(glyph, "right-bearing")
		if err != nil {
			return nil, err
		}
		shift, err := source.Metric(glyph, "shift-up")
		if err != nil {
			return nil, err
		}
		if left != 0 || right != float64(spacing) || shift != float64(int(shift)) {
			return nil, fmt.Errorf("line %d: unsupported bearings or fractional shift", glyph.Line)
		}
		top := baseline - glyph.Height - int(shift)
		if glyph.Width > 16 || top < 0 || top+glyph.Height > height {
			return nil, fmt.Errorf("line %d: glyph exceeds face geometry", glyph.Line)
		}
		g := Glyph{Width: glyph.Width, Rows: make([]uint16, height)}
		for y := 0; y < glyph.Height; y++ {
			for x := 0; x < glyph.Width; x++ {
				if glyph.Pixel(x, y) != 0 {
					g.Rows[top+y] |= 1 << x
				}
			}
		}
		for _, label := range glyph.Labels {
			if label.Kind == yaff.Character {
				if utf8.RuneCountInString(label.Value) != 1 {
					return nil, fmt.Errorf("line %d: board glyph labels must contain one Unicode character", glyph.Line)
				}
				r, _ := utf8.DecodeRuneInString(label.Value)
				if _, exists := f.Glyphs[r]; exists {
					return nil, fmt.Errorf("duplicate character %q", r)
				}
				f.Glyphs[r] = g
			}
			if hasDefault && label == defaultLabel {
				f.Fallback, defaultFound = g, true
			}
		}
	}
	if hasDefault && !defaultFound {
		return nil, fmt.Errorf("default-char does not identify a glyph")
	}
	return f, nil
}
