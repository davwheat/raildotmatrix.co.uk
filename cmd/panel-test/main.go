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
	"syscall"
	"time"

	"github.com/davwheat/led-departure-board/internal/frame"
	"github.com/davwheat/led-departure-board/internal/matrix"
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
	for ctx.Err() == nil {
		drawPattern(f, frames)
		if err := disp.Swap(f); err != nil {
			return err
		}
		frames++
	}

	elapsed := time.Since(start)
	fmt.Printf("%d frames in %.2fs: %.1f fps\n", frames, elapsed.Seconds(), float64(frames)/elapsed.Seconds())
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
