//go:build linux && arm64 && cgo

package matrix

/*
#cgo CFLAGS: -I${SRCDIR}/../../third_party/rpi-rgb-led-matrix/include
#cgo LDFLAGS: -L${SRCDIR}/../../build/lib -lrgbmatrix -lstdc++ -lm -lpthread -lrt

#include <stdlib.h>
#include <string.h>
#include "led-matrix-c.h"
#include "upload.h"
*/
import "C"

import (
	"errors"
	"fmt"
	"unsafe"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

type display struct {
	m *C.struct_RGBLedMatrix
	// canvas is off-screen and receives the next frame; onscreen is the one
	// the refresh thread is showing, or nil before the first swap.
	canvas, onscreen             *C.struct_LedCanvas
	w, h                         int
	canvasPixels, onscreenPixels uploadBuffer

	// The library keeps these pointers and reads them again whenever it
	// creates a canvas, so they live as long as the matrix does.
	hardware, sequence *C.char
}

// Open initializes the panels and starts the library's refresh thread. It
// must be called as root; see the package comment for the privilege drop that
// follows.
func Open(o *Options) (frame.Display, error) {
	if o == nil {
		o = Default()
	}

	var opts C.struct_RGBLedMatrixOptions
	var rt C.struct_RGBLedRuntimeOptions
	C.memset(unsafe.Pointer(&opts), 0, C.size_t(unsafe.Sizeof(opts)))
	C.memset(unsafe.Pointer(&rt), 0, C.size_t(unsafe.Sizeof(rt)))

	hardware := cStringOrNil(o.HardwareMapping)
	sequence := cStringOrNil(o.RGBSequence)

	opts.hardware_mapping = hardware
	opts.rows = C.int(o.Rows)
	opts.cols = C.int(o.Cols)
	opts.chain_length = C.int(o.Chain)
	opts.parallel = C.int(o.Parallel)
	opts.pwm_bits = C.int(o.PWMBits)
	opts.pwm_lsb_nanoseconds = C.int(o.PWMLSBNanoseconds)
	opts.pwm_dither_bits = C.int(o.PWMDitherBits)
	opts.brightness = C.int(o.Brightness)
	opts.scan_mode = C.int(o.ScanMode)
	opts.row_address_type = C.int(o.RowAddrType)
	opts.multiplexing = C.int(o.Multiplexing)
	opts.disable_hardware_pulsing = C.bool(o.DisableHardwarePulse)
	opts.show_refresh_rate = C.bool(o.ShowRefreshRate)
	opts.led_rgb_sequence = sequence
	opts.limit_refresh_rate_hz = C.int(o.LimitRefreshRateHz)
	opts.disable_busy_waiting = C.bool(o.DisableBusyWaiting)

	rt.gpio_slowdown = C.int(o.GPIOSlowdown)
	// The C shim only copies non-zero fields over the library defaults, and
	// the default for drop_privileges is on, so "off" has to be spelled -1.
	// daemon stays 0 (its default) so that the library starts the refresh
	// thread itself.
	if !o.DropPrivileges {
		rt.drop_privileges = -1
	}
	rt.do_gpio_init = true

	m := C.led_matrix_create_from_options_and_rt_options(&opts, &rt)
	if m == nil {
		C.free(unsafe.Pointer(hardware))
		C.free(unsafe.Pointer(sequence))
		return nil, errors.New("matrix: led_matrix_create failed; check the panel flags and that the process runs as root")
	}

	canvas := C.led_matrix_create_offscreen_canvas(m)
	var w, h C.int
	C.led_canvas_get_size(canvas, &w, &h)

	return &display{
		m: m, canvas: canvas, w: int(w), h: int(h),
		hardware: hardware, sequence: sequence,
	}, nil
}

func (d *display) Size() (w, h int) { return d.w, d.h }

// Swap copies changed rectangles into the off-screen canvas and blocks until
// the refresh thread has picked it up. frame.Frame.Pix is packed RGB, which is
// exactly the layout of an array of struct Color, so no conversion is needed.
func (d *display) Swap(f *frame.Frame) error {
	if f.W != d.w || f.H != d.h {
		return fmt.Errorf("matrix: frame is %dx%d, display is %dx%d", f.W, f.H, d.w, d.h)
	}
	if len(f.Pix) < f.W*f.H*3 {
		return fmt.Errorf("matrix: frame buffer has %d bytes, need %d", len(f.Pix), f.W*f.H*3)
	}
	d.canvasPixels.upload(f, func(x, y, width, height int) {
		offset := (y*d.w + x) * 3
		var previous *C.struct_Color
		if d.canvasPixels.valid {
			previous = (*C.struct_Color)(unsafe.Pointer(&d.canvasPixels.pixels[offset]))
		}
		C.set_changed_rect(d.canvas, C.int(x), C.int(y), C.int(width), C.int(height), C.int(d.w),
			(*C.struct_Color)(unsafe.Pointer(&f.Pix[offset])), previous)
	})
	d.onscreen = d.canvas
	d.canvas = C.led_matrix_swap_on_vsync(d.m, d.canvas)
	d.canvasPixels, d.onscreenPixels = d.onscreenPixels, d.canvasPixels
	return nil
}

// WaitVSync blocks until the refresh thread has shown one more frame, without
// uploading any pixels. Handing the library the canvas it is already showing
// makes it wait for the next refresh and give the same canvas back.
func (d *display) WaitVSync() error {
	if d.onscreen == nil {
		blank := d.canvas
		d.canvas = C.led_matrix_swap_on_vsync(d.m, blank)
		d.onscreen = blank
		d.canvasPixels, d.onscreenPixels = d.onscreenPixels, d.canvasPixels
		return nil
	}
	C.led_matrix_swap_on_vsync(d.m, d.onscreen)
	return nil
}

// SetBrightness changes the panel brightness in percent. The library applies
// brightness when pixels are written, so the change shows on the next Swap.
func (d *display) SetBrightness(percent int) error {
	if percent < 1 || percent > 100 {
		return fmt.Errorf("matrix: brightness %d%% is outside 1-100", percent)
	}
	C.led_matrix_set_brightness(d.m, C.uint8_t(percent))
	// Brightness is baked into native pixel data. Both canvases must be fully uploaded at their next swap,
	// even when the source RGB bytes did not change.
	d.canvasPixels.valid, d.onscreenPixels.valid = false, false
	return nil
}

// Close stops the refresh thread and blanks the panels.
func (d *display) Close() error {
	if d.m != nil {
		C.led_matrix_delete(d.m)
		d.m = nil
		d.canvas = nil
		C.free(unsafe.Pointer(d.hardware))
		C.free(unsafe.Pointer(d.sequence))
		d.hardware, d.sequence = nil, nil
	}
	return nil
}

func cStringOrNil(s string) *C.char {
	if s == "" {
		return nil
	}
	return C.CString(s)
}
