//go:build linux

package windowdisplay

import "github.com/davwheat/led-departure-board/internal/frame"

// Run always returns [ErrUnsupported] on Linux, where the window
// implementation isn't compiled. See the package comment.
func Run(Options, func(d frame.Display)) error {
	return ErrUnsupported
}
