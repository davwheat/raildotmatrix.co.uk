package update

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/atomicfile"
)

type Runner func(context.Context, string, ...string) ([]byte, error)

// Installer changes the system. Only departure-board-update.service runs it, because the manager's sandbox can't
// write to /opt or /etc/systemd.
type Installer struct {
	Layout
	// Root is prefixed to every managed path, so tests can install into a directory.
	Root       string
	ConfigPath string
	Key        ed25519.PublicKey
	Run        Runner
	// Settle is how long both services must stay up after an update before it counts as working.
	Settle time.Duration
	// Skip checks and service restarts, for the manager's demo mode.
	Demo bool
}

type Result struct {
	Time    time.Time `json:"time"`
	Version string    `json:"version"`
	Build   int       `json:"build"`
	OK      bool      `json:"ok"`
	Message string    `json:"message"`
}

// backup records one file as it was before an update.
type backup struct {
	Path    string `json:"path"`
	Existed bool   `json:"existed"`
	Mode    uint32 `json:"mode"`
}

// Apply installs the staged update, or rolls back one that an earlier run didn't finish.
func (in *Installer) Apply(ctx context.Context) error {
	if _, err := os.Stat(in.Applying()); err == nil {
		log.Print("a previous update was interrupted; restoring the files it replaced")
		err := errors.New("it was interrupted, so the board went back to the previous version")
		if rollBack := in.rollBack(ctx); rollBack != nil {
			err = fmt.Errorf("it was interrupted, and %w: %v", errRollBack, rollBack)
		}
		in.finish(nil, err, "")
		return err
	}
	target, err := in.apply(ctx)
	if err != nil {
		log.Printf("update failed: %v", err)
	}
	in.finish(target, err, "")
	return err
}

func (in *Installer) apply(ctx context.Context) (*Manifest, error) {
	data, err := os.ReadFile(in.StagedManifest())
	if err != nil {
		return nil, fmt.Errorf("no update is ready to install: %w", err)
	}
	sig, err := os.ReadFile(in.StagedSignature())
	if err != nil {
		return nil, err
	}
	target, err := VerifyManifest(data, sig, in.Key)
	if err != nil {
		return nil, err
	}
	installed, err := in.LoadInstalled()
	if err != nil {
		return target, err
	}
	p, err := MakePlan(in.Root, installed, target)
	if err != nil {
		return target, err
	}
	if len(p.Conflicts) > 0 {
		return target, conflictError(p.Conflicts)
	}
	for _, f := range p.Writes {
		got, _, err := hashFile(in.StagedFile(f.SHA256))
		if err != nil || got != f.SHA256 {
			return target, fmt.Errorf("the downloaded copy of %s is damaged", f.Path)
		}
	}
	if err := preflight(ctx, in.Run, in.Layout, in.Root, in.ConfigPath, target, p, in.Demo); err != nil {
		return target, err
	}
	if err := in.backUp(p); err != nil {
		return target, err
	}
	if err := atomicfile.Write(in.Applying(), []byte(strconv.Itoa(target.Build)+"\n"), 0600); err != nil {
		return target, err
	}
	log.Printf("installing %s (build %d): %d files to write, %d to remove", target.Version, target.Build, len(p.Writes), len(p.Removals))
	err = in.install(p)
	if err == nil {
		err = in.restart(ctx, paths(p))
	}
	if err != nil {
		if rollBack := in.rollBack(ctx); rollBack != nil {
			return target, fmt.Errorf("%w, and %w: %v", err, errRollBack, rollBack)
		}
		return target, fmt.Errorf("%w, so the board went back to the previous version", err)
	}
	if err := writeJSON(in.Installed(), target, 0600); err != nil {
		return target, err
	}
	return target, nil
}

// errRollBack means files of both versions might be installed. The marker and backup stay, so the manager starts
// this unit again when it next starts, and the rollback is retried.
var errRollBack = errors.New("restoring the previous version failed")

func (in *Installer) finish(target *Manifest, err error, message string) {
	r := Result{Time: time.Now(), OK: err == nil, Message: message}
	if target != nil {
		r.Version, r.Build = target.Version, target.Build
	}
	if errors.Is(err, errRollBack) {
		r.Message = "The update failed and the board couldn't go back to the previous version. It tries again when it next starts: " + err.Error()
		writeJSON(in.Result(), r, 0600)
		return
	}
	if r.Message == "" && err != nil {
		r.Message = "The update failed: " + err.Error()
	} else if r.Message == "" {
		r.Message = "Updated to " + r.Version + "."
	}
	// The marker goes before the staged files, so a marker always has the staged manage binary that recovers it.
	os.Remove(in.Applying())
	os.RemoveAll(in.Staged())
	os.RemoveAll(in.Previous())
	if err := writeJSON(in.Result(), r, 0600); err != nil {
		log.Printf("record update result: %v", err)
	}
}

func paths(p Plan) []string {
	var all []string
	for _, f := range p.Writes {
		all = append(all, f.Path)
	}
	return append(all, p.Removals...)
}

func (in *Installer) backUp(p Plan) error {
	if err := os.RemoveAll(in.Previous()); err != nil {
		return err
	}
	var saved []backup
	for i, path := range paths(p) {
		full := filepath.Join(in.Root, path)
		info, err := os.Stat(full)
		if errors.Is(err, fs.ErrNotExist) {
			saved = append(saved, backup{Path: path})
			continue
		} else if err != nil {
			return err
		}
		data, err := os.ReadFile(full)
		if err != nil {
			return err
		}
		if err := atomicfile.Write(filepath.Join(in.Previous(), strconv.Itoa(i)), data, 0600); err != nil {
			return err
		}
		saved = append(saved, backup{Path: path, Existed: true, Mode: uint32(info.Mode().Perm())})
	}
	return writeJSON(filepath.Join(in.Previous(), "index.json"), saved, 0600)
}

func (in *Installer) install(p Plan) error {
	for _, f := range p.Writes {
		data, err := os.ReadFile(in.StagedFile(f.SHA256))
		if err != nil {
			return err
		}
		if err := atomicfile.Write(filepath.Join(in.Root, f.Path), data, os.FileMode(f.FileMode())); err != nil {
			return err
		}
	}
	for _, path := range p.Removals {
		if err := os.Remove(filepath.Join(in.Root, path)); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return err
		}
	}
	return nil
}

func (in *Installer) rollBack(ctx context.Context) error {
	var saved []backup
	if err := readJSON(filepath.Join(in.Previous(), "index.json"), &saved); err != nil {
		return fmt.Errorf("read the backup of the previous version: %w", err)
	}
	var changed []string
	for i, b := range saved {
		full := filepath.Join(in.Root, b.Path)
		changed = append(changed, b.Path)
		if !b.Existed {
			if err := os.Remove(full); err != nil && !errors.Is(err, fs.ErrNotExist) {
				return err
			}
			continue
		}
		data, err := os.ReadFile(filepath.Join(in.Previous(), strconv.Itoa(i)))
		if err != nil {
			return err
		}
		if err := atomicfile.Write(full, data, os.FileMode(b.Mode)); err != nil {
			return err
		}
	}
	// The previous version's files are back, so trying again can't help if the services still fail.
	if err := in.restart(ctx, changed); err != nil {
		log.Printf("after restoring the previous version: %v", err)
	}
	return nil
}

// restart reloads whatever reads the changed files, then restarts both services and waits to see that they stay
// up. Restarting the manager doesn't stop this process, which runs in its own unit.
func (in *Installer) restart(ctx context.Context, changed []string) error {
	if in.Demo {
		return nil
	}
	reload := func(prefix string, name string, args ...string) error {
		for _, path := range changed {
			if strings.HasPrefix(path, prefix) {
				if out, err := in.Run(ctx, name, args...); err != nil {
					return fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, out)
				}
				return nil
			}
		}
		return nil
	}
	if err := reload("/etc/systemd/", "systemctl", "daemon-reload"); err != nil {
		return err
	}
	if err := reload("/etc/NetworkManager/system-connections/", "nmcli", "connection", "reload"); err != nil {
		return err
	}
	units := []string{BoardUnit, ManageUnit}
	restarts := map[string]string{}
	for _, unit := range units {
		if out, err := in.Run(ctx, "systemctl", "restart", unit); err != nil {
			return fmt.Errorf("%s didn't restart: %s", unit, strings.TrimSpace(string(out)))
		}
		restarts[unit] = in.property(ctx, unit, "NRestarts")
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(in.Settle):
	}
	// A unit with Restart=always can look active between crashes, so a changed restart count also means failure.
	for _, unit := range units {
		if state := in.property(ctx, unit, "ActiveState"); state != "active" {
			return fmt.Errorf("%s isn't running (%s)", unit, state)
		}
		if in.property(ctx, unit, "NRestarts") != restarts[unit] {
			return fmt.Errorf("%s keeps stopping", unit)
		}
	}
	return nil
}

func (in *Installer) property(ctx context.Context, unit, name string) string {
	out, _ := in.Run(ctx, "systemctl", "show", "--property", name, "--value", unit)
	return strings.TrimSpace(string(out))
}

// preflight runs the target release's board against this board's settings, before anything is changed.
func preflight(ctx context.Context, run Runner, l Layout, root, configPath string, target *Manifest, p Plan, demo bool) error {
	if demo {
		return nil
	}
	board := targetPath(l, root, p, BoardPath)
	if out, err := run(ctx, board, "-check-config", "-config", configPath); err != nil {
		return fmt.Errorf("the new version can't use this board's settings: %s", strings.TrimSpace(string(out)))
	}
	if out, err := run(ctx, board, "-config-schema"); err != nil {
		return fmt.Errorf("the new version doesn't start: %s", strings.TrimSpace(string(out)))
	}
	if missing := missingPackages(ctx, run, target.Packages); len(missing) > 0 {
		return fmt.Errorf("the new version needs these packages, which aren't installed: %s", strings.Join(missing, ", "))
	}
	return nil
}

func missingPackages(ctx context.Context, run Runner, packages []string) []string {
	var missing []string
	for _, pkg := range packages {
		out, err := run(ctx, "dpkg-query", "--show", "--showformat=${Status}", pkg)
		if err != nil || strings.TrimSpace(string(out)) != "install ok installed" {
			missing = append(missing, pkg)
		}
	}
	return missing
}

func conflictError(conflicts []Conflict) error {
	var names []string
	for _, c := range conflicts {
		names = append(names, c.Path)
	}
	return fmt.Errorf("these files were changed on this board, so the update would overwrite them: %s", strings.Join(names, ", "))
}

// VerifyInstalled checks that every file in the installed manifest is on disk as the manifest describes it.
func (in *Installer) VerifyInstalled() error {
	m, err := LoadManifest(in.Installed())
	if err != nil {
		return err
	}
	for _, f := range m.Files {
		disk, mode, err := hashFile(filepath.Join(in.Root, f.Path))
		if err != nil {
			return err
		}
		if disk != f.SHA256 || mode != f.FileMode() {
			return fmt.Errorf("%s doesn't match the installed manifest", f.Path)
		}
	}
	return nil
}
