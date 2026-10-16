package formats

import (
	"bytes"
	"flag"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/board"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix/pngdisplay"
)

var update = flag.Bool("update", false, "rewrite the golden images from the current rendering")

const (
	goldenDir = "testdata/golden"
	// failureDir is under the git-ignored build directory, where CI collects the frames that didn't match.
	failureDir = "../../build/golden-failures"
	// goldenScale is large enough for the round dots to read as a panel.
	goldenScale = 4
)

// goldenSize is a size a board is drawn at: the LED panel, or the website's layout.
type goldenSize struct {
	name string
	w, h int
}

var panel = goldenSize{"panel", 256, 64}

var webSizes = map[string]goldenSize{
	"daktronics": {"web", 193, 36},
	"infotec":    {"web", 272, 70},
}

type goldenCase struct {
	name    string
	board   string
	fixture string
	size    goldenSize
	config  Config
	at      time.Duration
}

func goldenCases() []goldenCase {
	var cases []goldenCase
	add := func(format, fixture, variant string, size goldenSize, c Config, at time.Duration) {
		name := fmt.Sprintf("%s--%s--%s", format, size.name, fixture)
		if variant != "" {
			name += "--" + variant
		}
		c.Width, c.Height = size.w, size.h
		if fixture == "detailed-formation" && c.CoachLetterTOCs == nil {
			// Include this Southern fixture to keep coverage of the coach letter page.
			c.CoachLetterTOCs = []string{"SN"}
		}
		cases = append(cases, goldenCase{name: name, board: format, fixture: fixture, size: size, config: c, at: at})
	}
	for _, format := range Names {
		at := Settled[format]
		for _, size := range []goldenSize{panel, webSizes[format]} {
			for _, fixture := range fixtures.Names {
				fixtureAt := at
				// The alteration blinks for six seconds and then gives way to the trains.
				if format == "daktronics" && fixture == "platform-alteration" {
					fixtureAt = 4600 * time.Millisecond
				}
				add(format, fixture, "", size, Config{}, fixtureAt)
			}
			add(format, "busy-board", "platform-prefix", size, Config{RowPrefix: board.PrefixPlatforms}, at)
			add(format, "stand-clear", "warning-platform", size, Config{WarningPlatform: true}, at)
			add(format, "non-public-train", "warning-platform", size, Config{WarningPlatform: true}, at)
		}
	}
	for _, size := range []goldenSize{panel, webSizes["daktronics"]} {
		for _, fixture := range []string{"busy-board", "dividing-service", "terminating", "three-way-split"} {
			add("daktronics", fixture, "worldline", size, Config{Worldline: true}, Settled["daktronics"])
		}
		// The single calling point's "only" reaches the board 10.6 seconds in, after the line scrolls in.
		add("daktronics", "single-call", "worldline", size, Config{Worldline: true}, 11500*time.Millisecond)
		for _, fixture := range []string{"long-destination", "hyphenated-destination", "long-dividing-service"} {
			add("daktronics", fixture, "", size, Config{}, Settled["daktronics"])
		}
		for _, fixture := range []string{"long-destination", "hyphenated-destination", "triple-line", "long-dividing-service"} {
			add("daktronics", fixture, "reserve-etd-column", size, Config{ReserveETDColumn: true}, Settled["daktronics"])
		}
		// The bus's calling prefix rests at the right edge between 3 and 4.5 seconds, before the line scrolls.
		add("daktronics", "replacement-bus", "", size, Config{}, 4*time.Second)
	}
	add("infotec", "busy-board", "white", panel, Config{Colour: board.White}, Settled["infotec"])
	for _, size := range []goldenSize{panel, webSizes["infotec"]} {
		add("infotec", "dividing-second", "platform-box", size, Config{PlatformBox: true}, Settled["infotec"])
	}
	for _, size := range []goldenSize{panel, webSizes["infotec"]} {
		add("infotec", "busy-board", "small-scrolling-text", size, Config{SmallScrollingText: true}, Settled["infotec"])
		noSeparator := false
		add("infotec", "busy-board", "no-separator", size, Config{ServiceSeparator: &noSeparator}, Settled["infotec"])
		add("infotec", "busy-board", "platform-box-no-separator", size, Config{PlatformBox: true, Platforms: []string{"2"}, ServiceSeparator: &noSeparator}, Settled["infotec"])
		add("infotec", "busy-board", "small-scrolling-text-platform-box", size, Config{SmallScrollingText: true, PlatformBox: true}, Settled["infotec"])
		add("infotec", "busy-board", "small-scrolling-text-calling", size, Config{SmallScrollingText: true, PlatformBox: true}, 11*time.Second)
		for _, style := range []string{"number", "coaches", "coaches-no-brackets", "carriages", "carriages-no-brackets"} {
			add("infotec", "detailed-formation", "count-"+style, size, Config{PlatformBox: true, FormationCount: style}, Settled["infotec"])
		}
		for _, style := range []string{"normal", "small-seconds", "small"} {
			add("infotec", "busy-board", "clock-"+style, size, Config{PlatformBox: true, ClockStyle: style}, Settled["infotec"])
		}
		for i, page := range []string{"letters", "loading", "facilities-1", "facilities-2", "facilities-3"} {
			add("infotec", "detailed-formation", page, size, Config{PlatformBox: true, ClockStyle: "small-seconds"}, time.Duration(i*5+4)*time.Second)
		}
		compact := false
		add("infotec", "busy-board", "small-scrolling-text-platform-box-separate-clock", size, Config{SmallScrollingText: true, PlatformBox: true, CompactLowerRow: &compact}, Settled["infotec"])
		add("infotec", "busy-board", "platform-box-separate-clock", size, Config{PlatformBox: true, Platforms: []string{"2"}, CompactLowerRow: &compact}, Settled["infotec"])
		add("infotec", "busy-board", "compact-dot-ordinals", size, Config{PlatformBox: true, Platforms: []string{"2"}, OrdinalFormat: board.OrdinalDot, ServiceCount: 6}, Settled["infotec"])
		add("infotec", "busy-board", "platform-box-multiple", size, Config{PlatformBox: true, Platforms: []string{"1", "2"}}, Settled["infotec"])
		align := false
		add("infotec", "busy-board", "platform-box-unaligned", size, Config{PlatformBox: true, Platforms: []string{"2"}, AlignPlatformRows: &align}, Settled["infotec"])
		add("infotec", "busy-board", "platform-box", size, Config{PlatformBox: true, Platforms: []string{"2"}}, Settled["infotec"])
		add("infotec", "busy-board", "platform-box-10A", size, Config{PlatformBox: true, Platforms: []string{"10A"}, Colour: board.White}, Settled["infotec"])
	}
	return cases
}

// TestGolden renders every board format through every fixture and compares the frame with a checked-in image of
// round dots, which a reviewer can read as the panel. Run go test ./internal/formats -update to rewrite them.
func TestGolden(t *testing.T) {
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Fatal(err)
	}
	if *update {
		if err := os.MkdirAll(goldenDir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	want := map[string]bool{}
	for _, c := range goldenCases() {
		want[c.name+".png"] = true
		t.Run(c.name, func(t *testing.T) {
			c.config.Zone = zone
			got := pngdisplay.Dots(render(t, c), goldenScale)
			path := filepath.Join(goldenDir, c.name+".png")
			if *update {
				writePNG(t, path, got)
				return
			}
			golden, err := readPNG(path)
			if err != nil {
				t.Fatalf("%v; run go test ./internal/formats -update to create it", err)
			}
			if !samePixels(golden, got) {
				failure := filepath.Join(failureDir, c.name+".png")
				writePNG(t, failure, got)
				t.Errorf("frame differs from %s; the new frame is in %s", path, failure)
			}
		})
	}
	// A run limited to some cases can't tell which of the other images are stale.
	if *update && !strings.Contains(flag.Lookup("test.run").Value.String(), "/") {
		removeStale(t, want)
	}
}

// render plays the fixture as the board app would, at 50 Hz with any second view two seconds in, and returns the
// frame at c.at.
func render(t *testing.T, c goldenCase) *frame.Frame {
	t.Helper()
	b, err := New(c.board, c.config)
	if err != nil {
		t.Fatal(err)
	}
	return Play(b, fixtures.Steps(c.fixture), c.size.w, c.size.h, c.at)
}

func samePixels(a, b image.Image) bool {
	if a.Bounds() != b.Bounds() {
		return false
	}
	for y := b.Bounds().Min.Y; y < b.Bounds().Max.Y; y++ {
		for x := b.Bounds().Min.X; x < b.Bounds().Max.X; x++ {
			r1, g1, b1, a1 := a.At(x, y).RGBA()
			r2, g2, b2, a2 := b.At(x, y).RGBA()
			if r1 != r2 || g1 != g2 || b1 != b2 || a1 != a2 {
				return false
			}
		}
	}
	return true
}

func readPNG(path string) (image.Image, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return png.Decode(bytes.NewReader(data))
}

func writePNG(t *testing.T, path string, img image.Image) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	if err := (&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
}

// removeStale deletes the images of cases that no longer exist, so that a renamed case doesn't leave its old
// image behind.
func removeStale(t *testing.T, want map[string]bool) {
	entries, err := os.ReadDir(goldenDir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if !want[e.Name()] {
			if err := os.Remove(filepath.Join(goldenDir, e.Name())); err != nil {
				t.Fatal(err)
			}
		}
	}
}
