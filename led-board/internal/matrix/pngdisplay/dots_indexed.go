package pngdisplay

import (
	"image"
	"image/color"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// Dots enlarges a frame, drawing lit dots as discs when the scale allows.
// It preserves exact colours, using an indexed image when possible. Indexing the
// small source first avoids allocating and encoding a much larger RGBA image.
// A black background can add one colour beyond those present in the source.
func Dots(f *frame.Frame, scale int) image.Image {
	if scale < 1 {
		return dotsRGBA(f, scale)
	}
	var palette paletteFrame
	source := palette.scale(f, 1)
	if source == nil {
		return dotsRGBA(f, scale)
	}
	black, ok := palette.colours[0]
	if !ok {
		if len(palette.colours) == len(palette.entries) {
			return dotsRGBA(f, scale)
		}
		black = uint8(len(palette.colours))
		palette.colours[0] = black
		palette.entries[black] = color.RGBA{A: 255}
	}
	img := image.NewPaletted(image.Rect(0, 0, f.W*scale, f.H*scale), palette.palette[:len(palette.colours)])
	if black != 0 {
		for i := range img.Pix {
			img.Pix[i] = black
		}
	}
	spans := dotSpans(scale)
	for y := range f.H {
		for x := range f.W {
			index := source.Pix[y*source.Stride+x]
			if index == black {
				continue
			}
			for dy, span := range spans {
				start := (y*scale+dy)*img.Stride + x*scale + span.start
				for at := start; at < start+span.end-span.start; at++ {
					img.Pix[at] = index
				}
			}
		}
	}
	return img
}
