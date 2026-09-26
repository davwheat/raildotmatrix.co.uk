// Package windowdisplay shows the board in a desktop window so that it can be
// debugged without LED panels. Each LED is drawn as a round dot on black at a
// configurable scale, so the window resembles the real panel.
//
// The windowing library owns the process's main thread, so the package can't
// hand out a [frame.Display] to an already-running program. Instead, [Run]
// opens the window on the calling goroutine and runs the application in a
// second goroutine. On every platform other than Linux the window is provided
// by Ebitengine. Linux builds, which include the cross-compiled Pi binary,
// use a stub whose Run returns [ErrUnsupported].
package windowdisplay

import "errors"

// DefaultScale is the number of window pixels per LED when [Options.Scale] is
// zero.
const DefaultScale = 5

// ErrUnsupported is returned by Run on platforms without a window
// implementation.
var ErrUnsupported = errors.New("windowdisplay: not available on this platform")

// ErrClosed is returned by Swap after the window has closed.
var ErrClosed = errors.New("windowdisplay: window closed")

type Options struct {
	// Width and Height are the panel size in LEDs that Size reports and that
	// swapped frames must match.
	Width, Height int

	// Scale is the number of window pixels per LED. Values below 1 select
	// [DefaultScale].
	Scale int

	// Title is the window title. Empty selects "Departure board".
	Title string
}

func (o Options) withDefaults() Options {
	if o.Scale < 1 {
		o.Scale = DefaultScale
	}
	if o.Title == "" {
		o.Title = "Departure board"
	}
	return o
}
