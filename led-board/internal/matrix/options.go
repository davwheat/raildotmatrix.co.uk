// Package matrix drives chained HUB75 LED panels through the hzeller
// rpi-rgb-led-matrix library.
//
// The real driver is only built on linux/arm64 with cgo. On every other
// platform, [Open] returns an error so that code depending on this package
// still compiles and can fall back to a [frame.Display] such as pngdisplay.
//
// # Privileges
//
// The library needs root to map the GPIO registers. Once the hardware is
// initialized, and unless [Options.DropPrivileges] is false, it switches the
// whole process to the user and group "daemon". Any file the application opens
// after [Open] returns must therefore be readable by that user, and any file it
// writes must live in a directory that user can write to.
package matrix

import (
	"flag"
	"strconv"
)

// Options configures the panels and the refresh thread. Zero values, other
// than DropPrivileges, select the library's own defaults, so the struct maps
// directly onto RGBLedMatrixOptions and RGBLedRuntimeOptions. The mapstructure
// tags name the config file keys, which follow the library's flags.
type Options struct {
	Rows              int    `mapstructure:"rows"`
	Cols              int    `mapstructure:"cols"`
	Chain             int    `mapstructure:"chain"`
	Parallel          int    `mapstructure:"parallel"`
	Brightness        int    `mapstructure:"brightness"`
	PWMBits           int    `mapstructure:"pwm_bits"`
	PWMLSBNanoseconds int    `mapstructure:"pwm_lsb_nanoseconds"`
	PWMDitherBits     int    `mapstructure:"pwm_dither_bits"`
	RGBSequence       string `mapstructure:"rgb_sequence"`
	HardwareMapping   string `mapstructure:"gpio_mapping"`
	RowAddrType       int    `mapstructure:"row_addr_type"`
	Multiplexing      int    `mapstructure:"multiplexing"`
	ScanMode          int    `mapstructure:"scan_mode"`
	ShowRefreshRate   bool   `mapstructure:"show_refresh"`

	// DisableHardwarePulse turns off the PWM hardware used for output-enable
	// timing. Leave it false: without the hardware pulse the panel visibly
	// flickers.
	DisableHardwarePulse bool `mapstructure:"no_hardware_pulse"`

	// GPIOSlowdown slows the GPIO bit-bang so slower panels can keep up.
	GPIOSlowdown int `mapstructure:"slowdown_gpio"`

	// DropPrivileges switches the process to user "daemon" after the GPIO is
	// set up. See the package comment for what that means for file access.
	// The config key no_drop_privs is its negation, so callers set it
	// themselves.
	DropPrivileges bool `mapstructure:"-"`

	// LimitRefreshRateHz caps the panel refresh rate. Zero leaves it uncapped.
	LimitRefreshRateHz int `mapstructure:"limit_refresh"`

	// DisableBusyWaiting lets the refresh thread sleep between capped refreshes.
	// GPIO pulse timing is unchanged; leave this off if the OS's scheduling jitter is visible on the panel.
	DisableBusyWaiting bool `mapstructure:"no_busy_waiting"`
}

// Default returns the configuration the boards are laid out for: two chained
// 128x64 panels, 256x64 dots in all, on the "regular" wiring.
func Default() *Options {
	return &Options{
		Rows:       64,
		Cols:       128,
		Chain:      2,
		Parallel:   1,
		Brightness: 60,
		// The boards scroll at a fixed number of dots per second and need the
		// refresh to be a whole multiple of it, so cmd/board replaces this
		// rate, which is the Daktronics board's, with the selected board's own
		// and the depth with PWMBitsFor that rate, unless they're set
		// explicitly. A 100 ns LSB (the library default is 130) buys refresh
		// rate at every bit depth.
		PWMBits:            8,
		PWMLSBNanoseconds:  100,
		LimitRefreshRateHz: 96,
		RGBSequence:        "RGB",
		HardwareMapping:    "regular",
		GPIOSlowdown:       2,
		DropPrivileges:     true,
		DisableBusyWaiting: true,
	}
}

// maxRefreshHz is the fastest the panels refresh at each PWM bit depth with a
// 100 ns LSB and GPIO slowdown 2, measured with panel-test on a Pi Zero 2 W
// driving two ICN2037BP panels. Other panels and Pis differ; set led.pwm_bits
// if the refresh rate falls short.
var maxRefreshHz = [...]int{3: 171, 4: 151, 5: 136, 6: 122, 7: 111, 8: 102, 9: 94, 10: 87, 11: 82}

// PWMBitsFor returns the greatest PWM bit depth at which the panels still
// refresh at hz. More bits give finer shades, which is what fades need. It
// returns 3, the fewest bits a board can use, when even that is too slow.
func PWMBitsFor(hz int) int {
	for bits := 11; bits > 3; bits-- {
		if maxRefreshHz[bits] >= hz {
			return bits
		}
	}
	return 3
}

// AddFlags registers the panel flags on fs, named like the library's own
// command-line flags, and returns the Options they populate. Defaults come
// from [Default].
func AddFlags(fs *flag.FlagSet) *Options {
	o := Default()
	fs.IntVar(&o.Rows, "led-rows", o.Rows, "rows per panel")
	fs.IntVar(&o.Cols, "led-cols", o.Cols, "columns per panel")
	fs.IntVar(&o.Chain, "led-chain", o.Chain, "number of daisy-chained panels")
	fs.IntVar(&o.Parallel, "led-parallel", o.Parallel, "number of parallel chains")
	fs.IntVar(&o.Brightness, "led-brightness", o.Brightness, "brightness in percent (1-100)")
	fs.IntVar(&o.PWMBits, "led-pwm-bits", o.PWMBits, "PWM bits per colour (1-11); 0 uses the library default")
	fs.IntVar(&o.PWMLSBNanoseconds, "led-pwm-lsb-nanoseconds", o.PWMLSBNanoseconds, "on-time of the least significant PWM bit in nanoseconds; 0 uses the library default")
	fs.IntVar(&o.PWMDitherBits, "led-pwm-dither-bits", o.PWMDitherBits, "number of low PWM bits to time-dither")
	fs.StringVar(&o.RGBSequence, "led-rgb-sequence", o.RGBSequence, "colour order the panel expects, such as RGB or BGR")
	fs.StringVar(&o.HardwareMapping, "led-gpio-mapping", o.HardwareMapping, "GPIO wiring name, such as regular or adafruit-hat")
	fs.IntVar(&o.GPIOSlowdown, "led-slowdown-gpio", o.GPIOSlowdown, "GPIO slowdown factor (0-4)")
	fs.BoolVar(&o.DisableHardwarePulse, "led-no-hardware-pulse", o.DisableHardwarePulse, "don't use the PWM hardware for output-enable pulses")
	fs.BoolVar(&o.ShowRefreshRate, "led-show-refresh", o.ShowRefreshRate, "print the panel refresh rate to stderr")
	fs.IntVar(&o.LimitRefreshRateHz, "led-limit-refresh", o.LimitRefreshRateHz, "cap the panel refresh rate in Hz; 0 for no cap")
	fs.BoolVar(&o.DisableBusyWaiting, "led-no-busy-waiting", o.DisableBusyWaiting, "sleep between capped refreshes to save CPU (may increase refresh jitter)")
	fs.IntVar(&o.RowAddrType, "led-row-addr-type", o.RowAddrType, "row address type (0-5)")
	fs.IntVar(&o.Multiplexing, "led-multiplexing", o.Multiplexing, "multiplexing type (0 = direct)")
	fs.IntVar(&o.ScanMode, "led-scan-mode", o.ScanMode, "0 = progressive, 1 = interlaced")

	fs.Var(negatedBool{&o.DropPrivileges}, "led-no-drop-privs", "stay root after initializing the GPIO")
	return o
}

// negatedBool exposes a bool field under a flag that means its opposite, so
// -led-no-drop-privs clears DropPrivileges the way the library's flag does.
type negatedBool struct{ p *bool }

func (n negatedBool) String() string {
	if n.p == nil {
		return "false"
	}
	return strconv.FormatBool(!*n.p)
}

func (n negatedBool) Get() any { return !*n.p }

func (n negatedBool) Set(s string) error {
	v, err := strconv.ParseBool(s)
	if err != nil {
		return err
	}
	*n.p = !v
	return nil
}

func (negatedBool) IsBoolFlag() bool { return true }
