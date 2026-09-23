package font

import (
	"encoding/json"
	"os"
	"testing"
)

func TestPlatformFontMatchesBuilderExport(t *testing.T) {
	data, err := os.ReadFile("../../../tools/font.json")
	if err != nil {
		t.Fatal(err)
	}
	var source struct {
		Fonts []struct {
			Name   string
			Glyphs map[string]struct {
				Width, Height int
				Rows          []string
			}
		}
	}
	if err := json.Unmarshal(data, &source); err != nil {
		t.Fatal(err)
	}
	for _, face := range source.Fonts {
		if face.Name != "Large Platform Number" {
			continue
		}
		for char, original := range face.Glyphs {
			g, ok := InfotecPlatform.Glyphs[[]rune(char)[0]]
			if !ok || g.Width != original.Width || len(g.Rows) != original.Height-1 {
				t.Fatalf("%q: imported dimensions differ from source", char)
			}
			for y, row := range original.Rows[1:] {
				for x, pixel := range row {
					if (g.Rows[y]&(1<<x) != 0) != (pixel == '1') {
						t.Errorf("%q pixel (%d,%d) differs from font builder", char, x, y)
					}
				}
			}
		}
		return
	}
	t.Fatal("platform font missing from builder export")
}
