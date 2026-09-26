// Command imagediff draws the pixels that differ between two PNGs in magenta over a faded copy of the first, as the
// website's visual tests do, so that CI can show a pull request's changes to the board screenshots.
//
// Usage: imagediff [-tolerance n] before.png after.png diff.png
//
// It prints the number of differing pixels, or "size" when the images differ in size, and writes diff.png only
// when some pixels differ.
package main

import (
	"bytes"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
)

func main() {
	// Matches CHANNEL_TOLERANCE in the website's visual tests, which ignores antialiasing noise.
	tolerance := flag.Int("tolerance", 4, "the largest change in any one channel that doesn't count as a difference")
	flag.Parse()
	if flag.NArg() != 3 {
		fmt.Fprintln(os.Stderr, "usage: imagediff [-tolerance n] before.png after.png diff.png")
		os.Exit(2)
	}
	if err := run(flag.Arg(0), flag.Arg(1), flag.Arg(2), *tolerance); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(beforePath, afterPath, diffPath string, tolerance int) error {
	before, err := readPNG(beforePath)
	if err != nil {
		return err
	}
	after, err := readPNG(afterPath)
	if err != nil {
		return err
	}
	if before.Bounds().Size() != after.Bounds().Size() {
		fmt.Println("size")
		return nil
	}
	diff, differing := compare(before, after, tolerance)
	fmt.Println(differing)
	if differing == 0 {
		return nil
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, diff); err != nil {
		return err
	}
	return os.WriteFile(diffPath, buf.Bytes(), 0o644)
}

func compare(before, after image.Image, tolerance int) (*image.NRGBA, int) {
	bounds := before.Bounds()
	offset := after.Bounds().Min.Sub(bounds.Min)
	diff := image.NewNRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	magenta := color.NRGBA{R: 255, B: 255, A: 255}
	differing := 0
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			a := color.NRGBAModel.Convert(before.At(x, y)).(color.NRGBA)
			b := color.NRGBAModel.Convert(after.At(x+offset.X, y+offset.Y)).(color.NRGBA)
			at := image.Pt(x-bounds.Min.X, y-bounds.Min.Y)
			if maxDelta(a, b) > tolerance {
				differing++
				diff.SetNRGBA(at.X, at.Y, magenta)
				continue
			}
			a.A = uint8((int(a.A) + 2) / 4)
			diff.SetNRGBA(at.X, at.Y, a)
		}
	}
	return diff, differing
}

func maxDelta(a, b color.NRGBA) int {
	return max(
		abs(int(a.R)-int(b.R)),
		abs(int(a.G)-int(b.G)),
		abs(int(a.B)-int(b.B)),
		abs(int(a.A)-int(b.A)),
	)
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func readPNG(path string) (image.Image, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decoding %s: %w", path, err)
	}
	return img, nil
}
