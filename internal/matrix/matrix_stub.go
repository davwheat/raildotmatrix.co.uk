//go:build !(linux && arm64 && cgo)

package matrix

import (
	"errors"

	"github.com/davwheat/led-departure-board/internal/frame"
)

// ErrUnsupported is returned by Open on platforms without the LED driver.
var ErrUnsupported = errors.New("matrix: LED panels are only available on linux/arm64 builds with cgo")

// Open always fails on this platform. Use windowdisplay or pngdisplay to
// inspect rendering.
func Open(*Options) (frame.Display, error) {
	return nil, ErrUnsupported
}
