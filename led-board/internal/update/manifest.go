// Package update installs new board releases from GitHub, one changed file at a time.
//
// Each release publishes a signed manifest per image variant that lists every file the image manages, with its
// SHA-256. A board records the manifest it last installed. Comparing the files on disk with both manifests shows
// which files the release changes and which of those someone has edited by hand. An edited file stops the update.
package update

import (
	"crypto/ed25519"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
	"strconv"
	"strings"
)

const (
	Stable      = "stable"
	Prerelease  = "prerelease"
	Development = "development"
)

const schemaVersion = 1

type Manifest struct {
	Schema  int    `json:"schema"`
	Version string `json:"version"`
	Commit  string `json:"commit"`
	Build   int    `json:"build"`
	Channel string `json:"channel"`
	Variant string `json:"variant"`
	// Packages lists the Debian packages the release needs. Updates don't install packages, so a missing one
	// stops the update.
	Packages []string         `json:"packages,omitempty"`
	Assets   map[string]Asset `json:"assets,omitempty"`
	Files    []File           `json:"files"`
}

// Asset is a release download. A .xz asset holds one file; a .tar.xz asset holds several.
type Asset struct {
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
}

type File struct {
	Path   string `json:"path"`
	Mode   string `json:"mode"`
	SHA256 string `json:"sha256"`
	Asset  string `json:"asset,omitempty"`
	// Member is the file's name inside a .tar.xz asset.
	Member string `json:"member,omitempty"`
}

func (f File) FileMode() uint32 {
	mode, _ := strconv.ParseUint(f.Mode, 8, 32)
	return uint32(mode)
}

func (m *Manifest) File(p string) (File, bool) {
	for _, f := range m.Files {
		if f.Path == p {
			return f, true
		}
	}
	return File{}, false
}

var (
	sha256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	modePattern   = regexp.MustCompile(`^0[0-7]{3}$`)
	assetPattern  = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)
)

// Never-managed paths hold each board's own settings and identity. A manifest that lists one is rejected, so even
// a faulty release can't overwrite them.
var userPaths = []string{
	"/boot/firmware/departure-board.toml",
	"/boot/firmware/dietpi.txt",
	"/boot/firmware/config.txt",
	"/boot/firmware/raildotmatrix/",
	"/var/lib/departure-board/",
	"/etc/NetworkManager/system-connections/departure-board-client.nmconnection",
	"/root/",
}

func ParseManifest(data []byte) (*Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}
	if m.Schema != schemaVersion {
		return nil, fmt.Errorf("manifest format %d isn't supported; this board needs a newer updater", m.Schema)
	}
	if m.Build < 0 || m.Variant == "" {
		return nil, errors.New("manifest has no build number or variant")
	}
	seen := map[string]bool{}
	for _, f := range m.Files {
		if !path.IsAbs(f.Path) || path.Clean(f.Path) != f.Path || seen[f.Path] {
			return nil, fmt.Errorf("manifest has an invalid or repeated path %q", f.Path)
		}
		seen[f.Path] = true
		for _, p := range userPaths {
			if f.Path == p || strings.HasSuffix(p, "/") && strings.HasPrefix(f.Path, p) {
				return nil, fmt.Errorf("manifest tries to manage %s, which belongs to the board's owner", f.Path)
			}
		}
		if !sha256Pattern.MatchString(f.SHA256) || !modePattern.MatchString(f.Mode) {
			return nil, fmt.Errorf("manifest has an invalid hash or mode for %s", f.Path)
		}
		if f.Asset != "" {
			if _, ok := m.Assets[f.Asset]; !ok {
				return nil, fmt.Errorf("manifest puts %s in missing asset %s", f.Path, f.Asset)
			}
			if strings.HasSuffix(f.Asset, ".tar.xz") == (f.Member == "") {
				return nil, fmt.Errorf("manifest doesn't say where to find %s in %s", f.Path, f.Asset)
			}
		}
	}
	for name, a := range m.Assets {
		if !assetPattern.MatchString(name) || !strings.HasSuffix(name, ".xz") || !sha256Pattern.MatchString(a.SHA256) || a.Size <= 0 {
			return nil, fmt.Errorf("manifest has an invalid asset %q", name)
		}
	}
	return &m, nil
}

func ManifestName(variant string) string { return "manifest-" + variant + ".json" }

//go:embed signing.pub
var signingKey string

// PublicKey returns the key that release manifests are signed with, or nil if this build has none.
func PublicKey() ed25519.PublicKey {
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signingKey))
	if err != nil || len(key) != ed25519.PublicKeySize {
		return nil
	}
	return key
}

// VerifyManifest checks a manifest's detached signature, a base64 Ed25519 signature of the manifest's exact bytes.
func VerifyManifest(data, signature []byte, key ed25519.PublicKey) (*Manifest, error) {
	if key == nil {
		return nil, errors.New("this build has no key to check updates with")
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(signature)))
	if err != nil || !ed25519.Verify(key, data, sig) {
		return nil, errors.New("the update's signature is invalid")
	}
	return ParseManifest(data)
}

func Sign(data []byte, key ed25519.PrivateKey) []byte {
	return []byte(base64.StdEncoding.EncodeToString(ed25519.Sign(key, data)) + "\n")
}
