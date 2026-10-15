package update

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ulikunitz/xz"
)

const unitFile = "/etc/systemd/system/departure-board.service"

// release is one build: the content of each managed file.
type release struct {
	tag, channel string
	build        int
	files        map[string]string
}

type fakeGitHub struct {
	t        *testing.T
	key      ed25519.PrivateKey
	server   *httptest.Server
	mu       sync.Mutex
	releases map[string]Release // by API path
	assets   map[string][]byte
	// conditional counts requests that carried If-None-Match.
	conditional int
}

func newFakeGitHub(t *testing.T) *fakeGitHub {
	_, key, _ := ed25519.GenerateKey(nil)
	g := &fakeGitHub{t: t, key: key, releases: map[string]Release{}, assets: map[string][]byte{}}
	g.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		g.mu.Lock()
		defer g.mu.Unlock()
		if name, ok := strings.CutPrefix(r.URL.Path, "/download/"); ok {
			data, ok := g.assets[name]
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Write(data)
			return
		}
		path := strings.TrimPrefix(r.URL.RequestURI(), "/repos/owner/repo")
		var body any
		if path == "/releases?per_page=10" {
			var list []Release
			for _, rel := range g.releases {
				list = append(list, rel)
			}
			slices.SortFunc(list, func(a, b Release) int { return b.PublishedAt.Compare(a.PublishedAt) })
			body = list
		} else if rel, ok := g.releases[path]; ok {
			body = rel
		} else {
			http.NotFound(w, r)
			return
		}
		data, _ := json.Marshal(body)
		etag := fmt.Sprintf(`"%x"`, hashBytes(data)[:16])
		if r.Header.Get("If-None-Match") != "" {
			g.conditional++
		}
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", etag)
		w.Write(data)
	}))
	t.Cleanup(g.server.Close)
	return g
}

func xzBytes(t *testing.T, data []byte) []byte {
	var out bytes.Buffer
	w, err := xz.NewWriter(&out)
	if err != nil {
		t.Fatal(err)
	}
	w.Write(data)
	w.Close()
	return out.Bytes()
}

// publish builds a release's assets and signed manifest, as cmd/release does, and serves them at path.
func (g *fakeGitHub) publish(path string, r release, published time.Time) *Manifest {
	m := &Manifest{Schema: 1, Version: r.tag, Commit: fmt.Sprintf("%040d", r.build), Build: r.build, Channel: r.channel, Variant: "rpi234", Assets: map[string]Asset{}}
	suffix := fmt.Sprintf("-%d", r.build)
	var tarball bytes.Buffer
	tw := tar.NewWriter(&tarball)
	paths := make([]string, 0, len(r.files))
	for p := range r.files {
		paths = append(paths, p)
	}
	slices.Sort(paths)
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, p := range paths {
		data := []byte(r.files[p])
		f := File{Path: p, Mode: "0644", SHA256: hashBytes(data)}
		if p == BoardPath {
			f.Mode, f.Asset = "0755", "board"+suffix+".xz"
			packed := xzBytes(g.t, data)
			g.assets[f.Asset] = packed
			m.Assets[f.Asset] = Asset{SHA256: hashBytes(packed), Size: int64(len(packed))}
		} else {
			f.Asset, f.Member = "system-files"+suffix+".tar.xz", strings.TrimPrefix(p, "/")
			tw.WriteHeader(&tar.Header{Name: f.Member, Mode: 0644, Size: int64(len(data)), Typeflag: tar.TypeReg})
			tw.Write(data)
		}
		m.Files = append(m.Files, f)
	}
	tw.Close()
	system := "system-files" + suffix + ".tar.xz"
	packed := xzBytes(g.t, tarball.Bytes())
	g.assets[system] = packed
	m.Assets[system] = Asset{SHA256: hashBytes(packed), Size: int64(len(packed))}
	data, _ := json.Marshal(m)
	g.assets[ManifestName("rpi234")+suffix] = data
	g.assets[ManifestName("rpi234")+suffix+".sig"] = Sign(data, g.key)
	rel := Release{Tag: r.tag, Name: r.tag, Prerelease: r.channel != Stable, PublishedAt: published}
	for name, data := range g.assets {
		if strings.Contains(name, suffix) {
			public := strings.Replace(name, ".json"+suffix, ".json", 1)
			digest := "sha256:" + hashBytes(data)
			rel.Assets = append(rel.Assets, ReleaseAsset{Name: public, Size: int64(len(data)), Digest: digest, URL: g.server.URL + "/download/" + name})
		}
	}
	g.releases[path] = rel
	return m
}

// fakeSystem answers the commands the updater runs, recording each one.
type fakeSystem struct {
	mu       sync.Mutex
	commands []string
	// failing names a unit that crashes after it starts.
	failing string
}

func (s *fakeSystem) run(_ context.Context, name string, args ...string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	command := strings.Join(append([]string{filepath.Base(name)}, args...), " ")
	s.commands = append(s.commands, command)
	switch {
	case name == "dpkg-query":
		return []byte("install ok installed"), nil
	case strings.Contains(command, "--property ActiveState"):
		if strings.HasSuffix(command, s.failing) && s.failing != "" {
			return []byte("activating\n"), nil
		}
		return []byte("active\n"), nil
	case strings.Contains(command, "--property NRestarts"):
		return []byte("0\n"), nil
	case strings.HasPrefix(command, "systemctl is-active"):
		return []byte("inactive\n"), fmt.Errorf("exit status 3")
	}
	return nil, nil
}

func (s *fakeSystem) ran(prefix string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.commands {
		if strings.HasPrefix(c, prefix) {
			return true
		}
	}
	return false
}

type harness struct {
	gh      *fakeGitHub
	sys     *fakeSystem
	root    string
	updater *Updater
}

func newHarness(t *testing.T, installed release) *harness {
	h := &harness{gh: newFakeGitHub(t), sys: &fakeSystem{}, root: t.TempDir()}
	state := t.TempDir()
	m := &Manifest{Schema: 1, Version: installed.tag, Commit: fmt.Sprintf("%040d", installed.build), Build: installed.build, Channel: installed.channel, Variant: "rpi234"}
	for p, content := range installed.files {
		mode := "0644"
		if p == BoardPath {
			mode = "0755"
		}
		write(t, filepath.Join(h.root, p), content, mode)
		m.Files = append(m.Files, File{Path: p, Mode: mode, SHA256: hashBytes([]byte(content))})
	}
	in := Installer{Layout: Layout{StateDir: state}, Root: h.root, ConfigPath: "/boot/firmware/departure-board.toml", Key: h.gh.key.Public().(ed25519.PublicKey), Run: h.sys.run}
	if err := writeJSON(in.Installed(), m, 0600); err != nil {
		t.Fatal(err)
	}
	h.updater = NewUpdater(in, &GitHub{API: h.gh.server.URL, Repo: "owner/repo", Client: h.gh.server.Client()})
	return h
}

func write(t *testing.T, path, content, mode string) {
	t.Helper()
	os.MkdirAll(filepath.Dir(path), 0755)
	perm := os.FileMode(0644)
	if mode == "0755" {
		perm = 0755
	}
	if err := os.WriteFile(path, []byte(content), perm); err != nil {
		t.Fatal(err)
	}
	os.Chmod(path, perm)
}

func (h *harness) read(t *testing.T, path string) string {
	data, err := os.ReadFile(filepath.Join(h.root, path))
	if err != nil {
		return "<missing>"
	}
	return string(data)
}

func (h *harness) settings(t *testing.T, channel string) {
	s := h.updater.Settings()
	s.Channel = channel
	if err := h.updater.SaveSettings(s); err != nil {
		t.Fatal(err)
	}
}

var v1 = release{tag: "v1.0.0", channel: Stable, build: 100, files: map[string]string{
	BoardPath: "board 1", ManagePath: "manage 1", unitFile: "[Service]\nExecStart=/opt/departure-board/board\n", "/etc/old.conf": "old",
}}
var v2 = release{tag: "v1.1.0", channel: Stable, build: 120, files: map[string]string{
	BoardPath: "board 2", ManagePath: "manage 2", unitFile: "[Service]\nExecStart=/opt/departure-board/board -v\n", "/etc/new.conf": "new",
}}

func TestInstallsOnlyChangedFiles(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now())
	ctx := context.Background()
	if err := h.updater.Check(ctx); err != nil {
		t.Fatal(err)
	}
	a := h.updater.Status().Available
	if a == nil || !a.Newer || a.UpToDate || len(a.Conflicts) > 0 {
		t.Fatalf("available = %+v", a)
	}
	if err := h.updater.Install(ctx, false); err != nil {
		t.Fatal(err)
	}
	if !h.sys.ran("systemctl start --no-block " + UpdateUnit) {
		t.Fatalf("the update unit wasn't started: %v", h.sys.commands)
	}
	if got := h.read(t, BoardPath); got != "board 1" {
		t.Fatalf("the manager changed the system itself: board = %q", got)
	}
	if err := h.updater.Installer.Apply(ctx); err != nil {
		t.Fatal(err)
	}
	for p, want := range v2.files {
		if got := h.read(t, p); got != want {
			t.Errorf("%s = %q, want %q", p, got, want)
		}
	}
	if got := h.read(t, "/etc/old.conf"); got != "<missing>" {
		t.Errorf("a file the release dropped is still there: %q", got)
	}
	if info, _ := os.Stat(filepath.Join(h.root, BoardPath)); info.Mode().Perm() != 0755 {
		t.Errorf("board mode = %v", info.Mode())
	}
	installed, _ := h.updater.LoadInstalled()
	if installed.Build != v2.build {
		t.Errorf("installed build = %d", installed.Build)
	}
	if !h.sys.ran("systemctl daemon-reload") || !h.sys.ran("systemctl restart "+ManageUnit) {
		t.Errorf("commands = %v", h.sys.commands)
	}
	for _, p := range []string{h.updater.Staged(), h.updater.Previous(), h.updater.Applying()} {
		if _, err := os.Stat(p); err == nil {
			t.Errorf("%s is left behind", p)
		}
	}
	if r := h.updater.Status().LastResult; r == nil || !r.OK {
		t.Errorf("result = %+v", r)
	}
	if err := h.updater.Check(ctx); err != nil {
		t.Fatal(err)
	}
	if a := h.updater.Status().Available; !a.UpToDate {
		t.Errorf("after updating, available = %+v", a)
	}
}

func TestEditedFileStopsTheUpdate(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now())
	edited := "[Service]\nExecStart=/opt/departure-board/board -mine\n"
	write(t, filepath.Join(h.root, unitFile), edited, "0644")
	ctx := context.Background()
	if err := h.updater.Check(ctx); err != nil {
		t.Fatal(err)
	}
	a := h.updater.Status().Available
	if len(a.Conflicts) != 1 || a.Conflicts[0].Path != unitFile {
		t.Fatalf("conflicts = %+v", a.Conflicts)
	}
	if !strings.Contains(a.Conflicts[0].Diff, "+ExecStart=/opt/departure-board/board -mine") {
		t.Errorf("diff = %q", a.Conflicts[0].Diff)
	}
	if err := h.updater.Install(ctx, false); err == nil || !strings.Contains(err.Error(), unitFile) {
		t.Fatalf("install err = %v", err)
	}
	if h.read(t, unitFile) != edited || h.read(t, BoardPath) != "board 1" {
		t.Error("a refused update changed files")
	}
	if h.sys.ran("systemctl start") {
		t.Error("a refused update started the update unit")
	}
}

func TestPlan(t *testing.T) {
	root := t.TempDir()
	installed := &Manifest{Files: []File{
		{Path: "/same", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/edited-unchanged", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/edited-changed", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/deleted-changed", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/adopted", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/dropped", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/dropped-edited", Mode: "0644", SHA256: hashBytes([]byte("a"))},
	}}
	for p, content := range map[string]string{"/same": "a", "/edited-unchanged": "mine", "/edited-changed": "mine", "/adopted": "b", "/dropped": "a", "/dropped-edited": "mine", "/unexpected": "x"} {
		write(t, filepath.Join(root, p), content, "0644")
	}
	b := File{Mode: "0644", SHA256: hashBytes([]byte("b")), Asset: "x.tar.xz", Member: "x"}
	target := &Manifest{Files: []File{
		{Path: "/same", Mode: "0644", SHA256: hashBytes([]byte("a"))},
		{Path: "/edited-unchanged", Mode: "0644", SHA256: hashBytes([]byte("a"))},
	}}
	for _, p := range []string{"/edited-changed", "/deleted-changed", "/adopted", "/new", "/unexpected"} {
		f := b
		f.Path = p
		target.Files = append(target.Files, f)
	}
	p, err := MakePlan(root, installed, target)
	if err != nil {
		t.Fatal(err)
	}
	var writes, conflicts []string
	for _, f := range p.Writes {
		writes = append(writes, f.Path)
	}
	for _, c := range p.Conflicts {
		conflicts = append(conflicts, c.Path)
	}
	if want := []string{"/new"}; !slices.Equal(writes, want) {
		t.Errorf("writes = %v, want %v", writes, want)
	}
	if want := []string{"/dropped"}; !slices.Equal(p.Removals, want) {
		t.Errorf("removals = %v, want %v", p.Removals, want)
	}
	if want := []string{"/edited-changed", "/deleted-changed", "/unexpected", "/dropped-edited"}; !slices.Equal(conflicts, want) {
		t.Errorf("conflicts = %v, want %v", conflicts, want)
	}
}

func TestFailedUpdateRollsBack(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now())
	h.sys.failing = BoardUnit
	ctx := context.Background()
	if err := h.updater.Check(ctx); err != nil {
		t.Fatal(err)
	}
	if err := h.updater.Install(ctx, false); err != nil {
		t.Fatal(err)
	}
	if err := h.updater.Installer.Apply(ctx); err == nil {
		t.Fatal("an update whose board doesn't stay up succeeded")
	}
	for p, want := range v1.files {
		if got := h.read(t, p); got != want {
			t.Errorf("%s = %q after rollback, want %q", p, got, want)
		}
	}
	if got := h.read(t, "/etc/new.conf"); got != "<missing>" {
		t.Errorf("a file the failed update added is still there")
	}
	if installed, _ := h.updater.LoadInstalled(); installed.Build != v1.build {
		t.Errorf("installed build = %d", installed.Build)
	}
	if _, err := os.Stat(h.updater.Applying()); err == nil {
		t.Error("the marker is left after a rollback, so every restart would roll back again")
	}
	if r := h.updater.Status().LastResult; r == nil || r.OK {
		t.Errorf("result = %+v", r)
	}
}

func TestInterruptedUpdateRollsBackAndManagerLeavesRunningUpdateAlone(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now())
	ctx := context.Background()
	if err := h.updater.Check(ctx); err != nil {
		t.Fatal(err)
	}
	if err := h.updater.Install(ctx, false); err != nil {
		t.Fatal(err)
	}
	installed, _ := h.updater.LoadInstalled()
	target, _ := LoadManifest(h.updater.StagedManifest())
	p, _ := MakePlan(h.root, installed, target)
	if err := h.updater.backUp(p); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(h.updater.Applying(), []byte("120\n"), 0600)
	// Power is lost after one file is written.
	write(t, filepath.Join(h.root, BoardPath), "board 2", "0755")

	running := &fakeSystem{}
	h.updater.Run = func(ctx context.Context, name string, args ...string) ([]byte, error) {
		if name == "systemctl" && args[0] == "is-active" {
			return []byte("activating\n"), nil
		}
		return running.run(ctx, name, args...)
	}
	h.updater.Resume(ctx)
	if running.ran("systemctl start") {
		t.Fatal("the manager restarted an update that is still running")
	}
	h.updater.Run = h.sys.run
	h.updater.Resume(ctx)
	if !h.sys.ran("systemctl start --no-block " + UpdateUnit) {
		t.Fatal("the manager didn't restart an interrupted update")
	}
	if err := h.updater.Installer.Apply(ctx); err == nil || !strings.Contains(err.Error(), "interrupted") {
		t.Fatalf("err = %v", err)
	}
	if got := h.read(t, BoardPath); got != "board 1" {
		t.Errorf("board = %q after recovery", got)
	}
	if _, err := os.Stat(h.updater.Applying()); err == nil {
		t.Error("the marker is left after recovery")
	}
}

func TestOlderChannelNeedsConfirmation(t *testing.T) {
	dev := v2
	dev.channel, dev.tag = Development, "v1.1.0-3-gabcdef0"
	h := newHarness(t, dev)
	h.gh.publish("/releases/latest", v1, time.Now())
	h.settings(t, Stable)
	ctx := context.Background()
	if err := h.updater.Check(ctx); err != nil {
		t.Fatal(err)
	}
	if a := h.updater.Status().Available; a.Newer || a.UpToDate {
		t.Fatalf("available = %+v", a)
	}
	if err := h.updater.Install(ctx, false); err == nil {
		t.Fatal("installed an older build without being asked")
	}
	if err := h.updater.Install(ctx, true); err != nil {
		t.Fatal(err)
	}
}

func TestChannels(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now().Add(-time.Hour))
	pre := release{tag: "v1.2.0-rc.1", channel: Prerelease, build: 130, files: v2.files}
	h.gh.publish("/releases/tags/v1.2.0-rc.1", pre, time.Now())
	dev := release{tag: "v1.2.0-rc.1-4-gabc", channel: Development, build: 134, files: v2.files}
	// The dev release is newest, but the prerelease channel must skip it.
	h.gh.publish("/releases/tags/dev", dev, time.Now().Add(time.Hour))
	h.gh.mu.Lock()
	rel := h.gh.releases["/releases/tags/dev"]
	rel.Tag = DevelopmentTag
	h.gh.releases["/releases/tags/dev"] = rel
	h.gh.mu.Unlock()
	ctx := context.Background()
	for channel, want := range map[string]int{Stable: 120, Prerelease: 130, Development: 134} {
		h.settings(t, channel)
		if err := h.updater.Check(ctx); err != nil {
			t.Fatalf("%s: %v", channel, err)
		}
		if got := h.updater.Status().Available.Build; got != want {
			t.Errorf("%s offers build %d, want %d", channel, got, want)
		}
	}
}

func TestChecksReuseETags(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now())
	ctx := context.Background()
	for range 2 {
		if err := h.updater.Check(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if h.gh.conditional != 1 {
		t.Errorf("%d conditional requests, want 1", h.gh.conditional)
	}
	reloaded := NewUpdater(h.updater.Installer, h.updater.GitHub)
	if err := reloaded.Check(ctx); err != nil {
		t.Fatal(err)
	}
	if h.gh.conditional != 2 {
		t.Error("a restarted manager forgot the ETag")
	}
}

func TestRejectsBadSignature(t *testing.T) {
	h := newHarness(t, v1)
	h.gh.publish("/releases/latest", v2, time.Now())
	_, other, _ := ed25519.GenerateKey(nil)
	h.updater.Key = other.Public().(ed25519.PublicKey)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := h.updater.Check(ctx); err == nil {
		t.Fatal("accepted a manifest signed with another key")
	}
}

func TestManifestCantManageOwnerFiles(t *testing.T) {
	data := []byte(`{"schema":1,"build":1,"variant":"rpi234","files":[{"path":"/boot/firmware/departure-board.toml","mode":"0644","sha256":"` + strings.Repeat("0", 64) + `"}]}`)
	if _, err := ParseManifest(data); err == nil {
		t.Fatal("accepted a manifest that manages the board's settings")
	}
}

func TestBaselineParses(t *testing.T) {
	m, err := Baseline()
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := m.File(BoardPath); !ok || m.Build <= 0 {
		t.Fatalf("baseline = %+v", m)
	}
}

func TestBootstrapRefusesChangedBoard(t *testing.T) {
	in := Installer{Layout: Layout{StateDir: t.TempDir()}, Root: t.TempDir(), Run: (&fakeSystem{}).run}
	if err := in.Bootstrap(context.Background(), t.TempDir()); err == nil || !strings.Contains(err.Error(), "reflash") {
		t.Fatalf("err = %v", err)
	}
}

func TestNextSlot(t *testing.T) {
	london, _ := time.LoadLocation("Europe/London")
	now := time.Date(2026, 10, 15, 4, 0, 0, 0, london) // A Thursday.
	cases := []struct {
		s    Settings
		want time.Time
	}{
		{Settings{Schedule: "daily", Time: "03:00"}, time.Date(2026, 10, 16, 3, 0, 0, 0, london)},
		{Settings{Schedule: "daily", Time: "05:30"}, time.Date(2026, 10, 15, 5, 30, 0, 0, london)},
		{Settings{Schedule: "weekly", Time: "03:00", Weekday: 4}, time.Date(2026, 10, 22, 3, 0, 0, 0, london)},
		{Settings{Schedule: "weekly", Time: "03:00", Weekday: 1}, time.Date(2026, 10, 19, 3, 0, 0, 0, london)},
	}
	for _, c := range cases {
		if got := NextSlot(now, c.s); !got.Equal(c.want) {
			t.Errorf("%+v: got %v, want %v", c.s, got, c.want)
		}
	}
}

func TestDiff(t *testing.T) {
	got := Diff("a", []byte("1\n2\n3\n"), "b", []byte("1\nX\n3\n"))
	want := "--- a\n+++ b\n@@ -1,3 +1,3 @@\n 1\n-2\n+X\n 3\n"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
	if Diff("a", []byte{0, 1}, "b", []byte("x")) != "Binary files differ." {
		t.Error("compared a binary file line by line")
	}
}
