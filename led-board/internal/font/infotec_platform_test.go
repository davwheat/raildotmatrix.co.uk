package font

import (
	"encoding/json"
	"os"
	"testing"
)

func TestImportedFontsMatchBuilderExport(t *testing.T) {
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
	faces := map[string]*Face{"Large Platform Number": InfotecPlatform, "Small main row": InfotecSmall, "Clock": InfotecClock, "Small Clock": InfotecSmallClock}
	for _, face := range source.Fonts {
		imported, exists := faces[face.Name]
		if !exists {
			continue
		}
		delete(faces, face.Name)
		skip := 0
		if face.Name == "Large Platform Number" {
			skip = 1
		}
		for char, original := range face.Glyphs {
			g, ok := imported.Glyphs[[]rune(char)[0]]
			if !ok || g.Width != original.Width || len(g.Rows) != original.Height-skip {
				t.Fatalf("%q: imported dimensions differ from source", char)
			}
			for y, row := range original.Rows[skip:] {
				for x, pixel := range row {
					if (g.Rows[y]&(1<<x) != 0) != (pixel == '1') {
						t.Errorf("%q pixel (%d,%d) differs from font builder", char, x, y)
					}
				}
			}
		}
	}
	if len(faces) != 0 {
		t.Fatalf("fonts missing from builder export: %v", faces)
	}
}
