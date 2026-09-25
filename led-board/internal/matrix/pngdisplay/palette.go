package pngdisplay

import (
	"image"
	"image/color"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

// LED frames usually contain only black and a few text/fade colours. Indexing
// those exact colours reduces PNG filtering and compression work without colour
// quantisation. Frames with more than 256 colours use the RGB encoder instead.
type paletteFrame struct {
	img     *image.Paletted
	colours map[uint32]uint8
	entries [256]color.RGBA
	palette color.Palette
}

// The PNG encoder copies 8-bit palette rows directly, while smaller palettes
// require a method call and bit packing for every enlarged pixel. Unused copies
// of the first colour select that faster path without changing any pixel index.
// Extra entries are overwritten by scale when later frames need those colours.
func (p *paletteFrame) scaleForStream(f *frame.Frame, scale int) *image.Paletted {
	img := p.scale(f, scale)
	if img != nil && len(img.Palette) < 17 {
		for i := len(img.Palette); i < 17; i++ {
			p.entries[i] = p.entries[0]
		}
		img.Palette = p.palette[:17]
	}
	return img
}

func (p *paletteFrame) scale(f *frame.Frame, scale int) *image.Paletted {
	if p.img == nil {
		p.img = image.NewPaletted(image.Rect(0, 0, f.W*scale, f.H*scale), nil)
		p.colours = make(map[uint32]uint8, 256)
		p.palette = make(color.Palette, 256)
		for i := range p.entries {
			p.palette[i] = &p.entries[i]
		}
	}
	clear(p.colours)
	previous := uint32(1 << 24) // Outside the 24-bit RGB range.
	var index uint8
	for y := range f.H {
		start := y * scale * p.img.Stride
		row := p.img.Pix[start : start+f.W*scale]
		for x := range f.W {
			i := (y*f.W + x) * 3
			c := uint32(f.Pix[i])<<16 | uint32(f.Pix[i+1])<<8 | uint32(f.Pix[i+2])
			if c != previous {
				var ok bool
				index, ok = p.colours[c]
				if !ok {
					if len(p.colours) == len(p.entries) {
						return nil
					}
					index = uint8(len(p.colours))
					p.colours[c] = index
					p.entries[index] = color.RGBA{R: f.Pix[i], G: f.Pix[i+1], B: f.Pix[i+2], A: 255}
				}
				previous = c
			}
			for to := x * scale; to < (x+1)*scale; to++ {
				row[to] = index
			}
		}
		for dy := 1; dy < scale; dy++ {
			to := start + dy*p.img.Stride
			copy(p.img.Pix[to:to+len(row)], row)
		}
	}
	p.img.Palette = p.palette[:len(p.colours)]
	return p.img
}
