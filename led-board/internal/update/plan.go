package update

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
)

type Plan struct {
	// Writes holds the files to replace or create, as the target manifest describes them.
	Writes []File `json:"writes"`
	// Removals holds managed files that the target release no longer ships.
	Removals  []string   `json:"removals"`
	Conflicts []Conflict `json:"conflicts"`
}

type Conflict struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
	// Diff compares the release's version with the board's copy, for text files the release ships.
	Diff string `json:"diff,omitempty"`
}

func (p Plan) Empty() bool { return len(p.Writes) == 0 && len(p.Removals) == 0 }

// Assets lists the downloads that contain the files to write.
func (p Plan) Assets() []string {
	var names []string
	for _, f := range p.Writes {
		if !slices.Contains(names, f.Asset) {
			names = append(names, f.Asset)
		}
	}
	slices.Sort(names)
	return names
}

// MakePlan compares the files under root with the installed and target manifests.
//
// A file the target changes is safe to replace only if it still matches the installed manifest. Files the target
// doesn't change are left alone, even if someone edited them. So are files that already match the target, so an
// edit that someone made by hand and the release then adopted doesn't stop the update.
func MakePlan(root string, installed, target *Manifest) (Plan, error) {
	var p Plan
	for _, f := range target.Files {
		old, known := installed.File(f.Path)
		if known && old.SHA256 == f.SHA256 && old.Mode == f.Mode {
			continue
		}
		disk, mode, err := hashFile(filepath.Join(root, f.Path))
		if err != nil {
			return Plan{}, err
		}
		if disk == f.SHA256 && mode == f.FileMode() {
			continue
		}
		if f.Asset == "" {
			return Plan{}, errors.New("the release doesn't include " + f.Path)
		}
		switch {
		case known && disk == old.SHA256, !known && disk == "":
			p.Writes = append(p.Writes, f)
		case disk == "":
			p.Conflicts = append(p.Conflicts, Conflict{Path: f.Path, Reason: "This file was deleted."})
		case known:
			p.Conflicts = append(p.Conflicts, Conflict{Path: f.Path, Reason: "This file was edited."})
		default:
			p.Conflicts = append(p.Conflicts, Conflict{Path: f.Path, Reason: "A file the update doesn't recognise is already here."})
		}
	}
	for _, f := range installed.Files {
		if _, kept := target.File(f.Path); kept {
			continue
		}
		disk, _, err := hashFile(filepath.Join(root, f.Path))
		if err != nil {
			return Plan{}, err
		}
		switch disk {
		case "":
		case f.SHA256:
			p.Removals = append(p.Removals, f.Path)
		default:
			p.Conflicts = append(p.Conflicts, Conflict{Path: f.Path, Reason: "This file was edited, and the update removes it."})
		}
	}
	return p, nil
}

// hashFile returns the SHA-256 and permission bits of a regular file, or an empty hash if there's no file.
func hashFile(path string) (string, uint32, error) {
	f, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return "", 0, nil
	}
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return "", 0, err
	}
	if !info.Mode().IsRegular() {
		return "not a regular file", 0, nil
	}
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(h.Sum(nil)), uint32(info.Mode().Perm()), nil
}

func hashBytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
