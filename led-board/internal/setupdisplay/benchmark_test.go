package setupdisplay

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/frame"
)

func BenchmarkTick(b *testing.B) {
	for _, width := range []int{128, 512} {
		b.Run(fmt.Sprintf("width-%d", width), func(b *testing.B) {
			path := filepath.Join(b.TempDir(), "network.json")
			if err := os.WriteFile(path, []byte(`{"mode":"connected","ips":["192.168.1.82"]}`), 0644); err != nil {
				b.Fatal(err)
			}
			board := Board{Path: path, Colour: frame.RGB{R: 230, G: 150}}
			f := frame.New(width, 64)
			now := time.Unix(100, 0)
			board.Tick(now, f)
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				now = now.Add(time.Second / 60)
				board.Tick(now, f)
			}
		})
	}
}
