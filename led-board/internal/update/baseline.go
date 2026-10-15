package update

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/atomicfile"
)

// Boards flashed with v0.0.0-alpha.1 have no installed manifest. This one was built from the files at that tag
// and the binary hashes in the release's build-info.txt.
//
//go:embed baselines/v0.0.0-alpha.1-rpi234.json
var baseline []byte

func Baseline() (*Manifest, error) { return ParseManifest(baseline) }

// Bootstrap gives a board flashed with v0.0.0-alpha.1 an updater, using a board binary, a manage binary and an
// update unit copied to dir. Their manager can't install the update unit itself, so this runs once over SSH.
func (in *Installer) Bootstrap(ctx context.Context, dir string) error {
	if _, err := os.Stat(in.Installed()); err == nil {
		return errors.New("this board already has an updater")
	} else if !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	installed, err := Baseline()
	if err != nil {
		return err
	}
	var edited []string
	for _, f := range installed.Files {
		if disk, _, err := hashFile(filepath.Join(in.Root, f.Path)); err != nil {
			return err
		} else if disk != f.SHA256 {
			edited = append(edited, f.Path)
		}
	}
	if len(edited) > 0 {
		return fmt.Errorf("this board doesn't match %s, so it can't be updated safely; reflash it instead. Changed files: %s", installed.Version, strings.Join(edited, ", "))
	}
	files := []File{
		{Path: BoardPath, Mode: "0755"},
		{Path: ManagePath, Mode: "0755"},
		{Path: UnitPath, Mode: "0644"},
	}
	for i, f := range files {
		data, err := os.ReadFile(filepath.Join(dir, filepath.Base(f.Path)))
		if err != nil {
			return err
		}
		if err := atomicfile.Write(filepath.Join(in.Root, f.Path), data, os.FileMode(f.FileMode())); err != nil {
			return err
		}
		files[i].SHA256 = hashBytes(data)
	}
	// Later releases replace the alpha's other files only if they still match the baseline, so the baseline's
	// version and build number stay, and only the hashes of the files installed here change.
	for _, f := range files {
		replaced := false
		for i := range installed.Files {
			if installed.Files[i].Path == f.Path {
				installed.Files[i], replaced = f, true
			}
		}
		if !replaced {
			installed.Files = append(installed.Files, f)
		}
	}
	if err := writeJSON(in.Installed(), installed, 0600); err != nil {
		return err
	}
	return in.restart(ctx, []string{UnitPath})
}
