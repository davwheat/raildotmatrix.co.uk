// Command fontgen converts the WOFF dot fonts in assets/fonts into the dot bitmaps in internal/font/data_gen.go.
// Each font places one contour per dot on a regular grid, so each contour in the outline maps to exactly one dot.
//
// Run it from anywhere inside the module:
//
//	go run github.com/davwheat/raildotmatrix.co.uk/led-board/cmd/fontgen [-preview out.png]
package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	preview := flag.String("preview", "", "also render sample text with every face to this PNG, scaled up 8x")
	out := flag.String("out", "", "generated Go file (default internal/font/data_gen.go under the module root)")
	fontsDir := flag.String("fonts", "", "directory holding the WOFF files (default assets/fonts under the module root)")
	flag.Parse()

	root, err := moduleRoot()
	if err != nil {
		fail(err)
	}
	if *out == "" {
		*out = filepath.Join(root, "internal", "font", "data_gen.go")
	}
	if *fontsDir == "" {
		*fontsDir = filepath.Join(root, "assets", "fonts")
	}

	faces := []faceSpec{
		{varName: "Text", doc: "the Data Display text face", file: "DataDisplayDaktronicsDMIfont.woff"},
		{varName: "Clock", doc: "the Data Display clock face", file: "DataDisplayDaktronicsDMIClockfont.woff"},
		{varName: "PISTall", doc: "the Infotec text face", file: "ModernNationalRailPISTall.woff"},
		{varName: "DotMatrixClock", doc: "the Infotec clock face", file: "subset-Dot_Matrix_Bold_Tall.woff", keep: "0123456789:"},
	}
	for i := range faces {
		faces[i].face, err = extractFace(filepath.Join(*fontsDir, faces[i].file))
		if err != nil {
			fail(err)
		}
		if faces[i].keep != "" {
			faces[i].face.subset(faces[i].keep)
		}
		report(faces[i])
	}

	src, err := emitSource(faces)
	if err != nil {
		fail(err)
	}
	if err := os.WriteFile(*out, src, 0o644); err != nil {
		fail(err)
	}
	fmt.Fprintf(os.Stderr, "wrote %s\n", *out)

	if *preview != "" {
		text, clock, pis, dotClock := faces[0].face, faces[1].face, faces[2].face, faces[3].face
		lines := []previewLine{
			{text, "1st 1943 London Victoria 1943"},
			{text, "Southern service. Formed of 8 coaches."},
			{text, "abcdefghijklmnopqrstuvwxyz"},
			{text, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
			{text, "0123456789 ×÷ :.,&"},
			{text, "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~‘’“”…"},
			{clock, "19:40:00"},
			{clock, "0123456789:"},
			{pis, "1st 19:45 Horsham"},
			{pis, "On time"},
			{pis, "A Southern service formed of 8 coaches."},
			{pis, "abcdefghijklmnopqrstuvwxyz"},
			{pis, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
			{pis, "0123456789 :.,&"},
			{pis, "!\"#%&'()*+,-./:;<=>?@[\\]^_{|}~"},
			{dotClock, "19:40:00"},
			{dotClock, "0123456789:"},
		}
		if err := writePreview(*preview, lines); err != nil {
			fail(err)
		}
		fmt.Fprintf(os.Stderr, "wrote %s\n", *preview)
	}
}

func report(s faceSpec) {
	f := s.face
	fmt.Fprintf(os.Stderr, "%s (%s): pitch %.3f units = em/%.3f; height %d, baseline %d, spacing %d, %d glyphs\n",
		s.varName, f.family, f.pitch, float64(f.unitsPerEm)/f.pitch, f.height, f.baseline, f.spacing, len(f.glyphs))
	for _, a := range f.anomalies {
		fmt.Fprintf(os.Stderr, "  anomaly: %s\n", a)
	}
}

func moduleRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", errors.New("fontgen: no go.mod found above the working directory")
		}
		dir = parent
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "fontgen:", err)
	os.Exit(1)
}
