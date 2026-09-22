package main

import (
	"image"
	"image/color"
	"image/png"
	"os"
)

// previewLine pairs a sample string with the face that renders it.
type previewLine struct {
	face *dotFace
	text string
}

const (
	previewScale  = 8
	previewMargin = 2
	previewGap    = 2
)

var previewInk = color.RGBA{R: 0xE6, G: 0x99, B: 0x0F, A: 0xFF}

// writePreview renders each line on its own row of dots and scales the result up so every dot becomes a disc,
// which is how the web board and the LED matrix both present the fonts.
func writePreview(path string, lines []previewLine) error {
	width, height := 0, previewMargin
	for _, l := range lines {
		width = max(width, textWidth(l.face, l.text))
		height += l.face.height + previewGap
	}
	width += 2 * previewMargin

	lit := make([][]bool, height)
	for i := range lit {
		lit[i] = make([]bool, width)
	}
	y := previewMargin
	for _, l := range lines {
		drawText(lit, previewMargin, y, l.face, l.text)
		y += l.face.height + previewGap
	}

	img := image.NewRGBA(image.Rect(0, 0, width*previewScale, height*previewScale))
	for py := range img.Rect.Dy() {
		for px := range img.Rect.Dx() {
			img.Set(px, py, color.Black)
		}
	}
	for row := range lit {
		for col, on := range lit[row] {
			if on {
				fillDisc(img, col, row)
			}
		}
	}

	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()
	return png.Encode(out, img)
}

func textWidth(f *dotFace, s string) int {
	w := 0
	for _, r := range s {
		w += glyphOf(f, r).width + f.spacing
	}
	return max(w-f.spacing, 0)
}

func glyphOf(f *dotFace, r rune) dotGlyph {
	if g, ok := f.glyphs[r]; ok {
		return g
	}
	return f.fallback
}

func drawText(lit [][]bool, x, y int, f *dotFace, s string) {
	for _, r := range s {
		g := glyphOf(f, r)
		for row, bits := range g.rows {
			for col := 0; bits != 0; col, bits = col+1, bits>>1 {
				if bits&1 != 0 {
					lit[y+row][x+col] = true
				}
			}
		}
		x += g.width + f.spacing
	}
}

func fillDisc(img *image.RGBA, col, row int) {
	const r = previewScale / 2.0
	cx, cy := float64(col*previewScale)+r, float64(row*previewScale)+r
	for py := row * previewScale; py < (row+1)*previewScale; py++ {
		for px := col * previewScale; px < (col+1)*previewScale; px++ {
			dx, dy := float64(px)+0.5-cx, float64(py)+0.5-cy
			if dx*dx+dy*dy <= r*r {
				img.SetRGBA(px, py, previewInk)
			}
		}
	}
}
