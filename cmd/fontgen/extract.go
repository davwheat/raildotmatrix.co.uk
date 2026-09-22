package main

import (
	"fmt"
	"math"
	"os"
	"slices"
	"sort"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

// dotGlyph mirrors font.Glyph: rows are top first and bit 0 is the leftmost dot.
type dotGlyph struct {
	width int
	rows  []uint16
}

// dotFace mirrors font.Face so the generator can render previews without importing the package it generates.
type dotFace struct {
	family   string
	height   int
	baseline int
	spacing  int
	glyphs   map[rune]dotGlyph
	fallback dotGlyph
	// pitch is the lattice spacing in font units, kept for the geometry report.
	pitch      float64
	unitsPerEm int
	anomalies  []string
}

type dot struct{ col, row int }

// snapTolerance is the largest distance, as a fraction of the pitch, that a contour centre may sit from a lattice
// point. FontStruct stores coordinates as rounded integers, so real deviations are well under 1%.
const snapTolerance = 0.1

func extractFace(path string) (*dotFace, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	ttf, err := decodeWOFF1(raw)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	f, err := sfnt.Parse(ttf)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}

	var buf sfnt.Buffer
	family, _ := f.Name(&buf, sfnt.NameIDFamily)
	upem := int(f.UnitsPerEm())

	type outline struct {
		r       rune
		advance float64
		boxes   []contourBox
	}
	var outlines []outline
	var xs, ys, sizes []float64
	for r := rune(1); r <= 0xFFFF; r++ {
		gi, err := f.GlyphIndex(&buf, r)
		if err != nil || gi == 0 {
			continue
		}
		adv, err := f.GlyphAdvance(&buf, gi, loadPPEM, font.HintingNone)
		if err != nil {
			return nil, fmt.Errorf("%q: %w", r, err)
		}
		segs, err := f.LoadGlyph(&buf, gi, loadPPEM, nil)
		if err != nil {
			return nil, fmt.Errorf("%q: %w", r, err)
		}
		o := outline{r: r, advance: toUnits(adv, upem)}
		o.boxes = splitContours(segs, upem)
		for _, c := range o.boxes {
			xs = append(xs, c.centreX())
			ys = append(ys, c.centreY())
			sizes = append(sizes, c.maxX-c.minX)
		}
		outlines = append(outlines, o)
	}

	pitch := latticePitch(append(xs, ys...), sizes)
	face := &dotFace{family: family, glyphs: map[rune]dotGlyph{}, pitch: pitch, unitsPerEm: upem}

	// Rows are counted from the baseline: negative rows are above it and row 0 is the first descender row.
	// The glyph cell is fixed after every glyph has been measured.
	var all []placed
	minRow, maxRow := 0, -1
	for _, o := range outlines {
		p := placed{r: o.r}
		advDots := o.advance / pitch
		p.advance = int(math.Round(advDots))
		if math.Abs(advDots-float64(p.advance)) > snapTolerance {
			face.anomalies = append(face.anomalies, fmt.Sprintf("%q: advance %.2f dots is not whole; rounded to %d", o.r, advDots, p.advance))
		}
		minCol, maxCol := math.MaxInt, math.MinInt
		for _, c := range o.boxes {
			col, okX := snap(c.centreX(), pitch)
			row, okY := snap(c.centreY(), pitch)
			if !okX || !okY {
				return nil, fmt.Errorf("%q: dot centre (%.1f, %.1f) is off the %.2f-unit lattice", o.r, c.centreX(), c.centreY(), pitch)
			}
			if !c.isDot(pitch) {
				face.anomalies = append(face.anomalies, fmt.Sprintf("%q: contour at column %d row %d is %.0fx%.0f units, not one dot", o.r, col, row, c.maxX-c.minX, c.maxY-c.minY))
			}
			d := dot{col: col, row: row}
			if slices.Contains(p.dots, d) {
				face.anomalies = append(face.anomalies, fmt.Sprintf("%q: duplicate dot at column %d row %d", o.r, col, row))
				continue
			}
			p.dots = append(p.dots, d)
			minCol, maxCol = min(minCol, col), max(maxCol, col)
			minRow, maxRow = min(minRow, row), max(maxRow, row)
		}
		if len(p.dots) > 0 {
			if minCol != 0 {
				face.anomalies = append(face.anomalies, fmt.Sprintf("%q: leftmost dot is in column %d; left bearing dropped", o.r, minCol))
				for i := range p.dots {
					p.dots[i].col -= minCol
				}
			}
			p.width = maxCol - minCol + 1
		}
		all = append(all, p)
	}

	face.baseline = -minRow
	face.height = maxRow - minRow + 1
	face.spacing = commonSpacing(face, all)

	for _, p := range all {
		g := dotGlyph{width: p.width, rows: make([]uint16, face.height)}
		if len(p.dots) == 0 {
			g.width = max(p.advance-face.spacing, 0)
		}
		for _, d := range p.dots {
			g.rows[d.row+face.baseline] |= 1 << d.col
		}
		face.glyphs[p.r] = g
	}

	if q, ok := face.glyphs['?']; ok {
		face.fallback = q
	} else {
		face.fallback = filledBlock(face)
	}
	return face, nil
}

// loadPPEM is the size glyphs are loaded at. sfnt multiplies font units by the ppem in 26.6 fixed point before
// dividing by unitsPerEm, which overflows int32 for coordinates above 4096 in an 8192-unit font, so glyphs are
// loaded at a fixed size and toUnits scales them back to font units.
var loadPPEM = fixed.I(2048)

func toUnits(v fixed.Int26_6, upem int) float64 {
	return float64(v) / 64 * float64(upem) / float64(loadPPEM>>6)
}

type contourBox struct{ minX, minY, maxX, maxY float64 }

func splitContours(segs sfnt.Segments, upem int) []contourBox {
	var boxes []contourBox
	for _, s := range segs {
		if s.Op == sfnt.SegmentOpMoveTo {
			boxes = append(boxes, contourBox{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)})
		}
		b := &boxes[len(boxes)-1]
		points := map[sfnt.SegmentOp]int{
			sfnt.SegmentOpMoveTo: 1, sfnt.SegmentOpLineTo: 1, sfnt.SegmentOpQuadTo: 2, sfnt.SegmentOpCubeTo: 3,
		}[s.Op]
		for _, a := range s.Args[:points] {
			x, y := toUnits(a.X, upem), toUnits(a.Y, upem)
			b.minX, b.maxX = min(b.minX, x), max(b.maxX, x)
			b.minY, b.maxY = min(b.minY, y), max(b.maxY, y)
		}
	}
	return boxes
}

// latticePitch fits the grid pitch to the dot-centre coordinates. Dot fonts place bricks on a regular grid and
// every glyph has adjacent dots somewhere, so the smallest gap is close to the pitch; a least-squares pass over
// the snapped indices then removes the integer rounding the font format applied to each coordinate. Gaps
// narrower than half a dot come from a dot drawn slightly off its row, not from neighbouring lattice lines.
func latticePitch(coords, sizes []float64) float64 {
	sort.Float64s(sizes)
	minGap := sizes[len(sizes)/2] / 2
	sort.Float64s(coords)
	pitch := math.Inf(1)
	for i := 1; i < len(coords); i++ {
		if gap := coords[i] - coords[i-1]; gap > minGap && gap < pitch {
			pitch = gap
		}
	}
	var num, den float64
	for _, v := range coords {
		i, _ := snap(v, pitch)
		k := float64(i) + 0.5
		num += v * k
		den += k * k
	}
	return num / den
}

// snap maps a dot-centre coordinate to its lattice index. Lattice points sit at (i + 0.5) * pitch, so that the
// baseline and the glyph origin fall between rows and columns.
func snap(v, pitch float64) (int, bool) {
	i := math.Round(v/pitch - 0.5)
	return int(i), math.Abs(v-(i+0.5)*pitch) <= snapTolerance*pitch
}

// placed is one glyph's dots in lattice coordinates, with row 0 the first row below the baseline and column 0
// the leftmost lit column.
type placed struct {
	r       rune
	dots    []dot
	advance int
	width   int
}

// commonSpacing returns the gap between advance and inked width shared by most glyphs, and records the glyphs
// that disagree. Empty glyphs have no inked width, so they take no part in the vote.
func commonSpacing(face *dotFace, all []placed) int {
	counts := map[int]int{}
	for _, p := range all {
		if len(p.dots) > 0 {
			counts[p.advance-p.width]++
		}
	}
	spacing, best := 0, 0
	for s, n := range counts {
		if n > best {
			spacing, best = s, n
		}
	}
	for _, p := range all {
		if len(p.dots) > 0 && p.advance-p.width != spacing {
			face.anomalies = append(face.anomalies, fmt.Sprintf("%q: advance %d minus width %d is not the common spacing %d", p.r, p.advance, p.width, spacing))
		}
	}
	return spacing
}

// subset drops every glyph not in keep. The fallback is rebuilt from the kept glyphs so that it cannot leak a
// dropped one.
func (f *dotFace) subset(keep string) {
	for r := range f.glyphs {
		if !strings.ContainsRune(keep, r) {
			delete(f.glyphs, r)
		}
	}
	f.fallback = filledBlock(f)
}

func filledBlock(face *dotFace) dotGlyph {
	width := 0
	for _, g := range face.glyphs {
		width = max(width, g.width)
	}
	g := dotGlyph{width: width, rows: make([]uint16, face.height)}
	for i := range face.baseline {
		g.rows[i] = 1<<width - 1
	}
	return g
}

func (b contourBox) centreX() float64 { return (b.minX + b.maxX) / 2 }
func (b contourBox) centreY() float64 { return (b.minY + b.maxY) / 2 }

// isDot reports whether the contour is one brick: a circle whose diameter is the lattice pitch.
func (b contourBox) isDot(pitch float64) bool {
	return math.Abs(b.maxX-b.minX-pitch) <= snapTolerance*pitch && math.Abs(b.maxY-b.minY-pitch) <= snapTolerance*pitch
}
