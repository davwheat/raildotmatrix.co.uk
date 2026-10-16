package management

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/testpattern"
	"github.com/pelletier/go-toml/v2"
)

// Exercise the HTTP API against the real board schema and validator. Hardware
// and systemd are replaced, so this also runs on developer machines and CI.
func TestManagementAPI(t *testing.T) {
	dir := t.TempDir()
	board := filepath.Join(dir, "board")
	cmd := exec.Command("go", "build", "-o", board, "../../cmd/board")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build board: %v: %s", err, output)
	}
	config := filepath.Join(dir, "departure-board.toml")
	initial := []byte("crs = \"\"\n[led]\nbrightness = 60\n")
	if err := os.WriteFile(config, initial, 0644); err != nil {
		t.Fatal(err)
	}
	restarts, rejectRestart := 0, false
	s, err := New(Options{BoardBinary: board, ConfigPath: config, StateDir: filepath.Join(dir, "state"), StatusPath: filepath.Join(dir, "network.json"), Run: func(ctx context.Context, name string, args ...string) ([]byte, error) {
		if name == "systemctl" {
			if args[0] == "restart" {
				restarts++
				if rejectRestart {
					return nil, errors.New("restart failed")
				}
			}
			return []byte("active"), nil
		}
		return Run(ctx, name, args...)
	}})
	if err != nil {
		t.Fatal(err)
	}
	handler := s.Handler()
	var cookie *http.Cookie
	request := func(method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://departureboard.local"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	expect := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("status %d, want %d: %s", w.Code, status, w.Body.String())
		}
	}
	getRevision := func() string {
		w := request("GET", "/api/config", "")
		expect(w, 200)
		var out struct {
			Revision string
			Fields   []any
		}
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		if len(out.Fields) < 30 {
			t.Fatalf("incomplete config schema: %d fields", len(out.Fields))
		}
		return out.Revision
	}
	save := func(rev, values string) *httptest.ResponseRecorder {
		return request("PUT", "/api/config", `{"revision":"`+rev+`","values":`+values+`}`)
	}
	expect(request("GET", "/api/config", ""), 401)
	expect(request("POST", "/api/login", `{"password":"incorrect"}`), 401)
	login := request("POST", "/api/login", `{"password":"DotMatrix"}`)
	expect(login, 200)
	cookie = login.Result().Cookies()[0]
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
		t.Fatal("session cookie is not protected")
	}
	data, _ := os.ReadFile(s.passwordPath())
	if bytes.Contains(data, []byte("DotMatrix")) {
		t.Fatal("stored plaintext password")
	}
	info, _ := os.Stat(s.passwordPath())
	if info.Mode().Perm() != 0600 {
		t.Fatal("password file must be private")
	}
	session := func() map[string]any {
		t.Helper()
		w := request("GET", "/api/session", "")
		expect(w, 200)
		var out map[string]any
		json.Unmarshal(w.Body.Bytes(), &out)
		return out
	}
	if got := session(); got["passwordChangeRequired"] != true || got["setupStep"] != "panels" {
		t.Fatalf("new board session = %v", got)
	}
	expect(request("GET", "/api/config", ""), 403)
	expect(request("POST", "/api/password", `{"password":"DotMatrix"}`), 400)
	expect(request("POST", "/api/password", `{"password":"first-password"}`), 200)
	if got := session(); got["authenticated"] != true || got["passwordChangeRequired"] != false {
		t.Fatalf("changing the password ended this session: %v", got)
	}
	rev := getRevision()
	expect(save(rev, `{"crs":"TOOLONG"}`), 400)
	expect(save(rev, `{"led":{"brightness":101}}`), 400)
	expect(save(rev, `{"led":{"rows":31}}`), 400)
	expect(save(rev, `{"led":{"brightness":40.5}}`), 400)
	expect(save(rev, `{"unknown":true}`), 400)
	expect(save(rev, `{"crs":"BTN","platforms":["1","2"],"led":{"brightness":40}}`), 200)
	if restarts != 1 {
		t.Fatalf("expected one restart, got %d", restarts)
	}
	data, _ = os.ReadFile(config)
	var values map[string]any
	if err := toml.Unmarshal(data, &values); err != nil {
		t.Fatal(err)
	}
	if values["led"].(map[string]any)["brightness"] != int64(40) {
		t.Fatalf("integer saved incorrectly: %s", data)
	}
	backup, _ := os.ReadFile(config + ".bak")
	if !bytes.Equal(backup, initial) {
		t.Fatal("old config was not backed up")
	}
	expect(save(rev, `{"crs":"VIC"}`), 409)
	rev = getRevision()
	rejectRestart = true
	expect(save(rev, `{"crs":"VIC"}`), 500)
	restored, _ := os.ReadFile(config)
	if !bytes.Equal(data, restored) {
		t.Fatal("restart failure lost previous config")
	}
	if restarts != 3 {
		t.Fatal("restart failure did not retry previous config")
	}
	updates := request("GET", "/api/update/status", "")
	expect(updates, 200)
	if !strings.Contains(updates.Body.String(), `"settings":{"channel":`) {
		t.Fatalf("update status = %s", updates.Body.String())
	}
	expect(request("PUT", "/api/update/settings", `{"channel":"nightly","schedule":"daily","time":"03:00","weekday":0,"autoInstall":false}`), 400)
	expect(request("PUT", "/api/update/settings", `{"channel":"development","schedule":"weekly","time":"04:30","weekday":2,"autoInstall":true}`), 200)
	updates = request("GET", "/api/update/settings", "")
	if !strings.Contains(updates.Body.String(), `"channel":"development"`) {
		t.Fatalf("update settings = %s", updates.Body.String())
	}
	expect(request("POST", "/api/update/install", `{"allowOlder":false}`), 202)
	for _, origin := range []string{"http://attacker.example", "null"} {
		r := httptest.NewRequest("POST", "http://departureboard.local/api/restart", nil)
		r.Header.Set("Origin", origin)
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		expect(w, 403)
	}
	r := httptest.NewRequest("GET", "http://attacker.example/api/config", nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	expect(w, 403)
	signedIn := cookie
	other := request("POST", "/api/login", `{"password":"first-password"}`)
	expect(other, 200)
	cookie = other.Result().Cookies()[0]
	expect(request("POST", "/api/password", `{"password":"replacement-password"}`), 200)
	expect(request("GET", "/api/config", ""), 200)
	cookie = signedIn
	expect(request("GET", "/api/config", ""), 401)
	expect(request("POST", "/api/login", `{"password":"first-password"}`), 401)
	expect(request("POST", "/api/login", `{"password":"replacement-password"}`), 200)
	reloaded, err := New(s.opts)
	if err != nil || reloaded.passwordDefault {
		t.Fatalf("reloaded password: default %v, %v", reloaded.passwordDefault, err)
	}
}

func TestSetupAndTestPatterns(t *testing.T) {
	dir := t.TempDir()
	board := filepath.Join(dir, "board")
	if output, err := exec.Command("go", "build", "-o", board, "../../cmd/board").CombinedOutput(); err != nil {
		t.Fatalf("build board: %v: %s", err, output)
	}
	config := filepath.Join(dir, "departure-board.toml")
	os.WriteFile(config, []byte("crs = \"\"\n"), 0644)
	var signals []string
	opts := Options{BoardBinary: board, ConfigPath: config, StateDir: filepath.Join(dir, "state"), StatusPath: filepath.Join(dir, "run", "network.json"), Run: func(ctx context.Context, name string, args ...string) ([]byte, error) {
		if name == "systemctl" {
			signals = append(signals, strings.Join(args, " "))
			return nil, nil
		}
		return Run(ctx, name, args...)
	}}
	os.MkdirAll(filepath.Dir(opts.StatusPath), 0755)
	s, err := New(opts)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.savePassword("setup-password"); err != nil {
		t.Fatal(err)
	}
	handler := s.Handler()
	var cookie *http.Cookie
	request := func(method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://departureboard.local"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	expect := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("status %d, want %d: %s", w.Code, status, w.Body.String())
		}
	}
	for _, path := range []string{"/board", "/network", "/setup/colours"} {
		w := request("GET", path, "")
		expect(w, 200)
		if !strings.Contains(w.Body.String(), "<!doctype html>") {
			t.Fatalf("%s did not serve the page", path)
		}
	}
	expect(request("GET", "/nowhere", ""), 404)
	login := request("POST", "/api/login", `{"password":"setup-password"}`)
	expect(login, 200)
	cookie = login.Result().Cookies()[0]

	expect(request("PUT", "/api/setup", `{"step":"elsewhere"}`), 400)
	expect(request("PUT", "/api/setup", `{"step":"station"}`), 200)
	if reloaded, err := New(opts); err != nil || reloaded.setupStep != "station" {
		t.Fatalf("setup progress after restart: %q, %v", reloaded.setupStep, err)
	}

	path := testpattern.Path(opts.StatusPath)
	expect(request("POST", "/api/test-pattern", `{"pattern":"purple"}`), 400)
	expect(request("POST", "/api/test-pattern", `{"pattern":"green"}`), 200)
	if r := testpattern.Read(path); !r.Showing(time.Now()) || r.Pattern != "green" {
		t.Fatalf("pattern request = %+v", r)
	}
	if len(signals) != 1 || !strings.Contains(signals[0], "SIGUSR1") {
		t.Fatalf("board not signalled: %v", signals)
	}
	expect(request("POST", "/api/test-pattern", `{"pattern":""}`), 200)
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("clearing the pattern left its request")
	}

	w := request("GET", "/api/config", "")
	var snapshot struct{ Revision string }
	json.Unmarshal(w.Body.Bytes(), &snapshot)
	expect(request("PUT", "/api/config", `{"revision":"`+snapshot.Revision+`","values":{"led":{"rgb_sequence":"GRB"}},"testPattern":"colours"}`), 200)
	if r := testpattern.Read(path); r.Pattern != "colours" {
		t.Fatalf("pattern after saving = %+v", r)
	}

	w = request("POST", "/api/colour-order", `{"current":"GRB","seen":"GRB"}`)
	expect(w, 200)
	if !strings.Contains(w.Body.String(), `"sequence":"RGB"`) {
		t.Fatalf("colour order = %s", w.Body.String())
	}
	expect(request("POST", "/api/colour-order", `{"current":"RGB","seen":"RRB"}`), 400)
}

func TestSetupSkippedForConfiguredBoard(t *testing.T) {
	dir := t.TempDir()
	config := filepath.Join(dir, "departure-board.toml")
	os.WriteFile(config, []byte("crs = \"BTN\"\n"), 0644)
	s := &Server{opts: Options{ConfigPath: config, StateDir: dir}}
	if err := s.loadSetup(); err != nil || s.setupStep != "done" {
		t.Fatalf("configured board setup step %q, %v", s.setupStep, err)
	}
}
