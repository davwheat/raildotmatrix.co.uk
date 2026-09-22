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
	expect(request("POST", "/api/password", `{"password":"replacement-password"}`), 200)
	expect(request("GET", "/api/config", ""), 401)
	expect(request("POST", "/api/login", `{"password":"DotMatrix"}`), 401)
	expect(request("POST", "/api/login", `{"password":"replacement-password"}`), 200)
}
