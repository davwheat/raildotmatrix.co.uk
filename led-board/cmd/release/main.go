// Command release packs a build into the files that boards update from, and signs their manifests.
//
//	go run ./cmd/release build -channel stable -out build/release
//	go run ./cmd/release sign build/release/manifest-*.json
//	go run ./cmd/release keygen
//
// Each binary becomes its own .xz asset, and the other managed files share system-files.tar.xz, so a board downloads
// only the assets that contain files it needs. Run it from led-board, after just board and just manager.
package main

import (
	"archive/tar"
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/update"
	"github.com/ulikunitz/xz"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: release build|sign|keygen [flags]")
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "build":
		err = build(os.Args[2:])
	case "sign":
		err = sign(os.Args[2:])
	case "keygen":
		err = keygen(os.Args[2:])
	default:
		err = fmt.Errorf("unknown command %q", os.Args[1])
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "release:", err)
		os.Exit(1)
	}
}

type entry struct{ mode, source, path string }

func readList(name string) ([]string, error) {
	data, err := os.ReadFile(name)
	if err != nil {
		return nil, err
	}
	var lines []string
	for line := range strings.Lines(string(data)) {
		if line = strings.TrimSpace(line); line != "" && !strings.HasPrefix(line, "#") {
			lines = append(lines, line)
		}
	}
	return lines, nil
}

func readEntries(name string) ([]entry, error) {
	lines, err := readList(name)
	if err != nil {
		return nil, err
	}
	var entries []entry
	bases := map[string]bool{}
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) != 3 {
			return nil, fmt.Errorf("%s: want MODE SOURCE PATH, got %q", name, line)
		}
		e := entry{fields[0], fields[1], fields[2]}
		if base := filepath.Base(e.source); bases[base] {
			return nil, fmt.Errorf("%s: two sources are named %s", name, base)
		} else {
			bases[base] = true
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func build(args []string) error {
	fs := flag.NewFlagSet("build", flag.ExitOnError)
	list := fs.String("files", "deploy/dietpi/managed-files.txt", "managed file list")
	packages := fs.String("packages", "deploy/dietpi/packages.txt", "required Debian packages")
	versionName := fs.String("version", "", "version name, such as v1.2.0")
	commit := fs.String("commit", "", "source commit")
	buildNumber := fs.Int("build", 0, "build number: the number of commits up to the source commit")
	channel := fs.String("channel", update.Development, "stable, prerelease or development")
	suffix := fs.String("suffix", "", "added to each asset name, so that development builds don't replace each other's assets")
	variants := fs.String("variants", "rpi234,rpi5", "image variants to write manifests for")
	out := fs.String("out", "build/release", "output directory")
	fs.Parse(args)
	if *versionName == "" || *commit == "" || *buildNumber <= 0 {
		return errors.New("-version, -commit and -build are required")
	}
	if !slices.Contains([]string{update.Stable, update.Prerelease, update.Development}, *channel) {
		return fmt.Errorf("unknown channel %q", *channel)
	}
	entries, err := readEntries(*list)
	if err != nil {
		return err
	}
	required, err := readList(*packages)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(*out, 0755); err != nil {
		return err
	}
	m := update.Manifest{
		Schema: 1, Version: *versionName, Commit: *commit, Build: *buildNumber, Channel: *channel,
		Packages: required, Assets: map[string]update.Asset{},
	}
	systemName := "system-files" + *suffix + ".tar.xz"
	var system bytes.Buffer
	tw := tar.NewWriter(&system)
	for _, e := range entries {
		data, err := os.ReadFile(e.source)
		if err != nil {
			return err
		}
		f := update.File{Path: e.path, Mode: e.mode, SHA256: hash(data)}
		if strings.HasPrefix(e.source, "build/") {
			f.Asset = filepath.Base(e.source) + *suffix + ".xz"
			if err := writeAsset(*out, f.Asset, data, m.Assets); err != nil {
				return err
			}
		} else {
			f.Asset, f.Member = systemName, strings.TrimPrefix(e.path, "/")
			// A fixed owner, mode and time keep the archive identical between builds of the same files.
			h := &tar.Header{Name: f.Member, Mode: 0644, Size: int64(len(data)), Typeflag: tar.TypeReg, Format: tar.FormatPAX}
			if err := tw.WriteHeader(h); err != nil {
				return err
			}
			if _, err := tw.Write(data); err != nil {
				return err
			}
		}
		m.Files = append(m.Files, f)
	}
	if err := tw.Close(); err != nil {
		return err
	}
	if err := writeAsset(*out, systemName, system.Bytes(), m.Assets); err != nil {
		return err
	}
	for _, variant := range strings.Split(*variants, ",") {
		m.Variant = variant
		data, err := json.MarshalIndent(m, "", "  ")
		if err != nil {
			return err
		}
		data = append(data, '\n')
		if _, err := update.ParseManifest(data); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(*out, update.ManifestName(variant)), data, 0644); err != nil {
			return err
		}
	}
	return nil
}

func writeAsset(dir, name string, data []byte, assets map[string]update.Asset) error {
	var packed bytes.Buffer
	w, err := xz.WriterConfig{DictCap: 16 << 20, CheckSum: xz.SHA256}.NewWriter(&packed)
	if err != nil {
		return err
	}
	if _, err := w.Write(data); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	assets[name] = update.Asset{SHA256: hash(packed.Bytes()), Size: int64(packed.Len())}
	return os.WriteFile(filepath.Join(dir, name), packed.Bytes(), 0644)
}

func hash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// sign writes NAME.sig beside each manifest, using the base64 Ed25519 seed in UPDATE_SIGNING_KEY.
func sign(args []string) error {
	fs := flag.NewFlagSet("sign", flag.ExitOnError)
	keyEnv := fs.String("key-env", "UPDATE_SIGNING_KEY", "environment variable holding the base64 private key seed")
	fs.Parse(args)
	seed, err := base64.StdEncoding.DecodeString(strings.TrimSpace(os.Getenv(*keyEnv)))
	if err != nil || len(seed) != ed25519.SeedSize {
		return fmt.Errorf("%s must hold a base64 Ed25519 seed; run release keygen to make one", *keyEnv)
	}
	key := ed25519.NewKeyFromSeed(seed)
	if public := update.PublicKey(); !bytes.Equal(public, key.Public().(ed25519.PublicKey)) {
		return errors.New("this key doesn't match internal/update/signing.pub, so boards would reject its signatures")
	}
	for _, name := range fs.Args() {
		data, err := os.ReadFile(name)
		if err != nil {
			return err
		}
		if err := os.WriteFile(name+".sig", update.Sign(data, key), 0644); err != nil {
			return err
		}
	}
	return nil
}

// keygen writes a new public key for boards to embed, and prints the private key seed to store as a secret.
func keygen(args []string) error {
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	publicPath := fs.String("public", "internal/update/signing.pub", "where to write the public key")
	fs.Parse(args)
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}
	if err := os.WriteFile(*publicPath, []byte(base64.StdEncoding.EncodeToString(public)+"\n"), 0644); err != nil {
		return err
	}
	fmt.Println(base64.StdEncoding.EncodeToString(private.Seed()))
	fmt.Fprintf(os.Stderr, "Wrote %s. Store the line above as the UPDATE_SIGNING_KEY Actions secret, and don't save it anywhere else.\n", *publicPath)
	return nil
}
