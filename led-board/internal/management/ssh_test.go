package management

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

func testSSHKey(t *testing.T) string {
	t.Helper()
	key, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	public, err := ssh.NewPublicKey(key)
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(string(ssh.MarshalAuthorizedKey(public))) + " developer@laptop"
}

func TestValidateSSHKeys(t *testing.T) {
	key := testSSHKey(t)
	for _, input := range []string{"", key, "# Existing keys\n\n" + key + "\n" + testSSHKey(t), `from="192.168.1.0/24",command="echo hello" ` + key} {
		got, err := validateSSHKeys(input)
		if err != nil {
			t.Fatal(err)
		}
		want := input
		if want != "" {
			want += "\n"
		}
		if string(got) != want {
			t.Fatalf("changed key comments or options: %q", got)
		}
	}
	if got, err := validateSSHKeys(key + "\r\n" + key + "\r\n"); err != nil || string(got) != key+"\n"+key+"\n" {
		t.Fatalf("CRLF normalization: %q, %v", got, err)
	}
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	ecdsaKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []any{&rsaKey.PublicKey, &ecdsaKey.PublicKey} {
		public, err := ssh.NewPublicKey(key)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := validateSSHKeys(string(ssh.MarshalAuthorizedKey(public))); err != nil {
			t.Fatalf("rejected %s: %v", public.Type(), err)
		}
	}
	for _, input := range []string{
		"not a public key", "ssh-ed25519 broken", "ssh-ed25519 AAAAB3NzaC1yc2E=",
		strings.Replace(key, "ssh-ed25519", "ssh-rsa", 1),
		"-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n-----END OPENSSH PRIVATE KEY-----",
		key + "\ninvalid second line", "invalid first line\n" + key,
		key + "\rhidden", key + "\x00", key + "\x1b", key + strings.Repeat("x", 8192),
		strings.Repeat(key+"\n", 400),
	} {
		if _, err := validateSSHKeys(input); err == nil {
			t.Errorf("accepted invalid input: %.100q", input)
		}
	}
}

func TestSSHKeysAPI(t *testing.T) {
	dir := t.TempDir()
	opts := Options{Demo: true, StateDir: filepath.Join(dir, "state"), Run: func(_ context.Context, _ string, args ...string) ([]byte, error) {
		if len(args) != 1 || args[0] != "-config-schema" {
			t.Fatalf("unexpected system command: %v", args)
		}
		return []byte("[]"), nil
	}}
	s, err := New(opts)
	if err != nil {
		t.Fatal(err)
	}
	if s.sshPath != filepath.Join(opts.StateDir, "ssh", "authorized_keys") {
		t.Fatalf("demo touches host SSH keys: %s", s.sshPath)
	}
	handler := s.Handler()
	var cookie *http.Cookie
	request := func(method, body, origin string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "http://departureboard.local/api/ssh-keys", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	expect := func(w *httptest.ResponseRecorder, code int) {
		t.Helper()
		if w.Code != code {
			t.Fatalf("status %d, want %d: %s", w.Code, code, w.Body)
		}
	}
	get := func() (string, string) {
		t.Helper()
		w := request("GET", "", "")
		expect(w, 200)
		var data map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
			t.Fatal(err)
		}
		return data["keys"], data["revision"]
	}
	save := func(keys, rev string) *httptest.ResponseRecorder {
		t.Helper()
		data, _ := json.Marshal(map[string]string{"keys": keys, "revision": rev})
		return request("PUT", string(data), "")
	}
	assertFile := func(want string) {
		t.Helper()
		data, err := os.ReadFile(s.sshPath)
		if err != nil || string(data) != want {
			t.Fatalf("SSH keys: %q, %v; want %q", data, err, want)
		}
	}
	expect(request("GET", "", ""), 401)
	expect(request("PUT", `{}`, ""), 401)
	r := httptest.NewRequest("POST", "http://departureboard.local/api/login", strings.NewReader(`{"password":"DotMatrix"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	expect(w, 200)
	cookie = w.Result().Cookies()[0]
	keys, rev := get()
	if keys != "" || rev != revision(nil) {
		t.Fatal("new board should have no keys")
	}
	for _, origin := range []string{"http://attacker.example", "null"} {
		expect(request("PUT", `{}`, origin), 403)
	}
	first := testSSHKey(t)
	second := testSSHKey(t)
	expect(save(first+"\r\n"+second, rev), 200)
	saved := first + "\n" + second + "\n"
	assertFile(saved)
	for path, mode := range map[string]os.FileMode{s.sshPath: 0600, filepath.Dir(s.sshPath): 0700} {
		info, err := os.Stat(path)
		if err != nil || info.Mode().Perm() != mode {
			t.Fatalf("incorrect permissions for %s: %v, %v", path, info, err)
		}
	}
	expect(save("", rev), 409)
	_, rev = get()
	expect(save("not a key", rev), 400)
	expect(request("PUT", `{"revision":"`+rev+`"}`, ""), 400)
	expect(request("PUT", `{"keys":null,"revision":"`+rev+`"}`, ""), 400)
	expect(save(strings.Repeat("x", maxSSHKeysSize+1), rev), 400)
	expect(save(strings.Repeat("x", 65536), rev), 400)
	assertFile(saved)
	// An edit made outside the GUI must not be overwritten with a stale snapshot.
	external := "# Manually installed\nrestrict " + first + "\n"
	if err := os.WriteFile(s.sshPath, []byte(external), 0600); err != nil {
		t.Fatal(err)
	}
	expect(save(second, rev), 409)
	keys, rev = get()
	if keys != external {
		t.Fatal("existing comments or key restrictions lost")
	}
	expect(save(keys+second, rev), 200)
	assertFile(external + second + "\n")
	restarted, err := New(opts)
	if err != nil {
		t.Fatal(err)
	}
	data, err := restarted.readSSHKeys()
	if err != nil || !bytes.Equal(data, []byte(external+second+"\n")) {
		t.Fatalf("keys did not persist: %q, %v", data, err)
	}
	_, rev = get()
	expect(save(second, rev), 200)
	assertFile(second + "\n")
	_, rev = get()
	expect(save("", rev), 200)
	assertFile("")
	// A filesystem error must reach the client and leave the target unchanged.
	target := filepath.Join(dir, "manual-keys")
	if err := os.WriteFile(target, []byte(first), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(s.sshPath); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, s.sshPath); err != nil {
		t.Fatal(err)
	}
	expect(request("GET", "", ""), 500)
	expect(save(second, revision([]byte(first))), 500)
	data, err = os.ReadFile(target)
	if err != nil || string(data) != first {
		t.Fatal("symlink target changed")
	}
}
