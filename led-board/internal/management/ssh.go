package management

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"golang.org/x/crypto/ssh"
)

const maxSSHKeysSize = 32768

func validateSSHKeys(input string) ([]byte, error) {
	input = strings.ReplaceAll(input, "\r\n", "\n")
	if input != "" && !strings.HasSuffix(input, "\n") {
		input += "\n"
	}
	if len(input) > maxSSHKeysSize {
		return nil, errors.New("SSH keys must fit within 32 KiB")
	}
	for i, line := range strings.Split(input, "\n") {
		if len(line) > 8192 || strings.ContainsFunc(line, func(r rune) bool { return unicode.IsControl(r) && r != '\t' }) {
			return nil, fmt.Errorf("line %d: invalid or excessively long SSH public key", i+1)
		}
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Parse each line separately: ParseAuthorizedKey skips invalid lines when
		// given a whole file, which could otherwise silently accept a bad key.
		if _, _, _, _, err := ssh.ParseAuthorizedKey([]byte(line)); err != nil {
			return nil, fmt.Errorf("line %d: paste a complete SSH public key on one line, not a private key", i+1)
		}
	}
	// Preserve comments and key options, including restrictions on existing keys.
	return []byte(input), nil
}

func (s *Server) readSSHKeys() ([]byte, error) {
	// Atomic replacement must not silently replace an administrator's symlink.
	for _, path := range []string{filepath.Dir(s.sshPath), s.sshPath} {
		info, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return nil, errors.New("SSH keys cannot be managed through a symbolic link")
		}
		if path == s.sshPath && !info.Mode().IsRegular() {
			return nil, errors.New("SSH keys must be stored in a regular file")
		}
	}
	f, err := os.Open(s.sshPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxSSHKeysSize+1))
	if err == nil && len(data) > maxSSHKeysSize {
		err = errors.New("SSH key file is larger than 32 KiB; edit it over SSH")
	}
	return data, err
}

func (s *Server) getSSHKeys(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.readSSHKeys()
	if err != nil {
		fail(w, 500, err)
		return
	}
	writeJSON(w, 200, map[string]string{"keys": string(data), "revision": revision(data)})
}

func (s *Server) putSSHKeys(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Keys     *string `json:"keys"`
		Revision string  `json:"revision"`
	}
	if !decode(w, r, &input) {
		return
	}
	if input.Keys == nil {
		fail(w, 400, errors.New("provide SSH public keys, or an empty string to remove all keys"))
		return
	}
	data, err := validateSSHKeys(*input.Keys)
	if err != nil {
		fail(w, 400, err)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old, err := s.readSSHKeys()
	if err != nil {
		fail(w, 500, err)
		return
	}
	if input.Revision != revision(old) {
		fail(w, 409, errors.New("SSH keys changed elsewhere; reload before saving"))
		return
	}
	dir := filepath.Dir(s.sshPath)
	if err = os.MkdirAll(dir, 0700); err == nil {
		err = os.Chmod(dir, 0700)
	}
	if err == nil {
		err = atomicWrite(s.sshPath, data, 0600)
	}
	if err != nil {
		fail(w, 500, fmt.Errorf("SSH keys were not saved: %w", err))
		return
	}
	message := "SSH keys saved. Changes apply to new SSH connections."
	if s.opts.Demo {
		message = "SSH keys saved in the local demo. This does not enable SSH access."
	}
	writeJSON(w, 200, map[string]string{"keys": string(data), "revision": revision(data), "message": message})
}
