// Command panel-test drives the LED panels with a moving pattern and reports
// how many frames per second Swap achieves. It proves that the cross-compiled
// binary links against the matrix library and runs on the Pi.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix"
)

func main() {
	opts := matrix.AddFlags(flag.CommandLine)
	seconds := flag.Float64("seconds", 10, "how long to run before exiting")
	flag.Parse()

	if err := run(opts, time.Duration(*seconds*float64(time.Second))); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(opts *matrix.Options, duration time.Duration) error {
	disp, err := matrix.Open(opts)
	if err != nil {
		return err
	}
	defer disp.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	w, h := disp.Size()
	fmt.Printf("display %dx%d\n", w, h)
	f := frame.New(w, h)

	start := time.Now()
	frames := 0
	var intervals []time.Duration
	previous := start
	for ctx.Err() == nil {
		drawPattern(f, frames)
		if err := disp.Swap(f); err != nil {
			return err
		}
		frames++
		now := time.Now()
		intervals = append(intervals, now.Sub(previous))
		previous = now
	}

	elapsed := time.Since(start)
	fmt.Printf("%d frames in %.2fs: %.1f fps\n", frames, elapsed.Seconds(), float64(frames)/elapsed.Seconds())
	// Include draw/upload time as well as the wait for VSync. Percentiles expose missed refreshes that an
	// average FPS hides when comparing panel timing options on the target hardware.
	if len(intervals) > 0 {
		slices.Sort(intervals)
		ms := func(p int) float64 { return float64(intervals[(len(intervals)-1)*p/100]) / float64(time.Millisecond) }
		fmt.Printf("frame interval ms: p50=%.3f p95=%.3f p99=%.3f max=%.3f\n", ms(50), ms(95), ms(99), ms(100))
	}
	return nil
}

func drawPattern(f *frame.Frame, tick int) {
	f.Clear()

	red := frame.RGB{R: 255}
	green := frame.RGB{G: 255}
	blue := frame.RGB{B: 255}
	white := frame.RGB{R: 255, G: 255, B: 255}

	f.FillRect(0, 0, f.W, 1, red)
	f.FillRect(0, f.H-1, f.W, 1, green)
	f.FillRect(0, 0, 1, f.H, blue)
	f.FillRect(f.W-1, 0, 1, f.H, white)

	for x := 0; x < f.W; x++ {
		f.Set(x, x*f.H/f.W, white)
	}

	bar := tick % f.H
	f.FillRect(0, bar, f.W, 1, frame.RGB{R: 255, G: 128})
}
