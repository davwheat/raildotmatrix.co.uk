package update

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/atomicfile"
	"github.com/ulikunitz/xz"
)

const (
	BoardPath  = "/opt/departure-board/board"
	ManagePath = "/opt/departure-board/manage"
	UnitPath   = "/etc/systemd/system/departure-board-update.service"
	UpdateUnit = "departure-board-update.service"
	BoardUnit  = "departure-board.service"
	ManageUnit = "departure-board-manager.service"
)

// Layout names the updater's files in the board's state directory.
type Layout struct{ StateDir string }

func (l Layout) Installed() string    { return filepath.Join(l.StateDir, "installed-manifest.json") }
func (l Layout) SettingsFile() string { return filepath.Join(l.StateDir, "update-settings.json") }
func (l Layout) dir() string          { return filepath.Join(l.StateDir, "update") }
func (l Layout) State() string        { return filepath.Join(l.dir(), "state.json") }
func (l Layout) Result() string       { return filepath.Join(l.dir(), "result.json") }

// Applying marks an update that has started changing files. Finding it when no update is running means the
// update was interrupted and must be rolled back.
func (l Layout) Applying() string { return filepath.Join(l.dir(), "applying") }

// Staged holds a downloaded, verified update until it's applied. departure-board-update.service runs the manage
// binary in it, so each release installs itself with its own code.
func (l Layout) Staged() string                  { return filepath.Join(l.dir(), "staged") }
func (l Layout) StagedManifest() string          { return filepath.Join(l.Staged(), "manifest.json") }
func (l Layout) StagedSignature() string         { return filepath.Join(l.Staged(), "manifest.json.sig") }
func (l Layout) StagedManage() string            { return filepath.Join(l.Staged(), "manage") }
func (l Layout) StagedFile(sha256 string) string { return filepath.Join(l.Staged(), "files", sha256) }
func (l Layout) Previous() string                { return filepath.Join(l.dir(), "previous") }

func LoadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseManifest(data)
}

// LoadInstalled reads the manifest of the files this board has. Boards flashed before updates existed don't have
// one, so the manifest of the release they were flashed with stands in for it.
func (l Layout) LoadInstalled() (*Manifest, error) {
	m, err := LoadManifest(l.Installed())
	if errors.Is(err, fs.ErrNotExist) {
		return Baseline()
	}
	return m, err
}

func writeJSON(path string, value any, mode os.FileMode) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return atomicfile.Write(path, append(data, '\n'), mode)
}

func readJSON(path string, value any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, value)
}

// maxUnpacked guards against an asset that expands far beyond any real board binary.
const maxUnpacked = 128 << 20

// unpack checks an asset against the signed manifest and returns its files: the single file in a .xz asset under
// the name "", or each regular file in a .tar.xz asset under its member name.
func unpack(name string, data []byte, want Asset) (map[string][]byte, error) {
	if int64(len(data)) != want.Size || hashBytes(data) != want.SHA256 {
		return nil, fmt.Errorf("%s doesn't match the release manifest", name)
	}
	r, err := xz.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	limited := &io.LimitedReader{R: r, N: maxUnpacked + 1}
	files := map[string][]byte{}
	if !strings.HasSuffix(name, ".tar.xz") {
		data, err := io.ReadAll(limited)
		if err == nil && limited.N <= 0 {
			err = errors.New("too large")
		}
		if err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		files[""] = data
		return files, nil
	}
	tr := tar.NewReader(limited)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			return files, nil
		}
		if err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		if h.Typeflag != tar.TypeReg {
			continue
		}
		if files[h.Name], err = io.ReadAll(tr); err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		if limited.N <= 0 {
			return nil, fmt.Errorf("%s: too large", name)
		}
	}
}

// fetchAsset downloads one asset from a release and checks it against both GitHub's hash and the signed manifest.
func fetchAsset(ctx context.Context, gh *GitHub, release Release, name string, want Asset) (map[string][]byte, error) {
	asset, ok := release.Asset(name)
	if !ok {
		return nil, fmt.Errorf("the release is missing %s", name)
	}
	if asset.Digest != "" && asset.Digest != "sha256:"+want.SHA256 {
		return nil, fmt.Errorf("%s on GitHub doesn't match the release manifest", name)
	}
	data, err := gh.Download(ctx, asset.URL, want.Size)
	if err != nil {
		return nil, err
	}
	return unpack(name, data, want)
}

// stage downloads the files a plan writes into the staging directory. The manifest and its signature are written
// last, so a staging directory with a manifest is always complete.
func stage(ctx context.Context, l Layout, root string, gh *GitHub, release Release, target *Manifest, manifest, signature []byte, p Plan) error {
	if err := os.RemoveAll(l.Staged()); err != nil {
		return err
	}
	for _, name := range p.Assets() {
		files, err := fetchAsset(ctx, gh, release, name, target.Assets[name])
		if err != nil {
			return err
		}
		for _, f := range p.Writes {
			if f.Asset != name {
				continue
			}
			data, ok := files[f.Member]
			if !ok || hashBytes(data) != f.SHA256 {
				return fmt.Errorf("%s in %s doesn't match the release manifest", f.Path, name)
			}
			if err := atomicfile.Write(l.StagedFile(f.SHA256), data, os.FileMode(f.FileMode())); err != nil {
				return err
			}
		}
	}
	manage := filepath.Join(root, ManagePath)
	if f, ok := target.File(ManagePath); ok {
		if _, err := os.Stat(l.StagedFile(f.SHA256)); err == nil {
			manage = l.StagedFile(f.SHA256)
		}
	}
	data, err := os.ReadFile(manage)
	if err != nil {
		return err
	}
	if err := atomicfile.Write(l.StagedManage(), data, 0755); err != nil {
		return err
	}
	if err := atomicfile.Write(l.StagedSignature(), signature, 0600); err != nil {
		return err
	}
	return atomicfile.Write(l.StagedManifest(), manifest, 0600)
}

// targetPath returns where a file of the target release is: staged if the update writes it, otherwise installed.
func targetPath(l Layout, root string, p Plan, path string) string {
	for _, f := range p.Writes {
		if f.Path == path {
			return l.StagedFile(f.SHA256)
		}
	}
	return filepath.Join(root, path)
}
