package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/update"
)

// The real managed file list must produce manifests that boards accept, with assets that hold every file.
func TestBuildPacksEveryManagedFile(t *testing.T) {
	root, _ := filepath.Abs("../..")
	t.Chdir(t.TempDir())
	os.MkdirAll("build", 0755)
	os.WriteFile("build/board", []byte("board binary"), 0755)
	os.WriteFile("build/manage", []byte("manage binary"), 0755)
	os.Symlink(filepath.Join(root, "deploy"), "deploy")
	err := build([]string{"-version", "v1.0.0", "-commit", "abc", "-build", "7", "-channel", "stable", "-suffix", "-abc1234", "-out", "out"})
	if err != nil {
		t.Fatal(err)
	}
	entries, err := readEntries("deploy/dietpi/managed-files.txt")
	if err != nil {
		t.Fatal(err)
	}
	for _, variant := range []string{"rpi234", "rpi5"} {
		data, err := os.ReadFile(filepath.Join("out", update.ManifestName(variant)))
		if err != nil {
			t.Fatal(err)
		}
		m, err := update.ParseManifest(data)
		if err != nil {
			t.Fatal(err)
		}
		if m.Variant != variant || m.Build != 7 || len(m.Files) != len(entries) || len(m.Packages) == 0 {
			t.Fatalf("manifest = %+v", m)
		}
		for name, asset := range m.Assets {
			data, err := os.ReadFile(filepath.Join("out", name))
			if err != nil {
				t.Fatal(err)
			}
			sum := sha256.Sum256(data)
			if hex.EncodeToString(sum[:]) != asset.SHA256 || int64(len(data)) != asset.Size {
				t.Errorf("%s doesn't match its manifest entry", name)
			}
		}
		board, _ := m.File(update.BoardPath)
		if board.Asset != "board-abc1234.xz" || board.Mode != "0755" {
			t.Errorf("board = %+v", board)
		}
	}
}
