package management

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"
)

type passwordRecord struct {
	Salt string `json:"salt"`
	Hash []byte `json:"hash"`
}

func hashPassword(password, salt string) []byte {
	key, _ := pbkdf2.Key(sha256.New, password, []byte(salt), 100000, 32)
	return key
}
func (s *Server) loadPassword() error {
	data, err := os.ReadFile(s.passwordPath())
	if errors.Is(err, os.ErrNotExist) {
		return s.savePassword("DotMatrix")
	}
	if err != nil {
		return err
	}
	if err = json.Unmarshal(data, &s.password); err != nil {
		return err
	}
	if len(s.password.Salt) < 16 || len(s.password.Hash) != 32 {
		return errors.New("invalid management password file")
	}
	return nil
}
func (s *Server) savePassword(password string) error {
	p := passwordRecord{Salt: randomToken()}
	p.Hash = hashPassword(password, p.Salt)
	data, _ := json.Marshal(p)
	if err := atomicWrite(s.passwordPath(), data, 0600); err != nil {
		return err
	}
	s.password = p
	return nil
}
func (s *Server) authenticated(r *http.Request) bool {
	cookie, err := r.Cookie("departureboard")
	if err != nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	expiry, ok := s.sessions[cookie.Value]
	return ok && time.Now().Before(expiry)
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Since(s.loginWindow) > time.Minute {
		s.loginWindow = time.Now()
		s.loginCount = 0
	}
	s.loginCount++
	if s.loginCount > 10 {
		fail(w, 429, errors.New("too many sign-in attempts; wait a minute"))
		return
	}
	if len(in.Password) > 256 || subtle.ConstantTimeCompare(hashPassword(in.Password, s.password.Salt), s.password.Hash) != 1 {
		fail(w, 401, errors.New("incorrect board password"))
		return
	}
	for token, expiry := range s.sessions {
		if time.Now().After(expiry) {
			delete(s.sessions, token)
		}
	}
	if len(s.sessions) >= 64 {
		clear(s.sessions)
	}
	token := randomToken()
	s.sessions[token] = time.Now().Add(12 * time.Hour)
	http.SetCookie(w, &http.Cookie{Name: "departureboard", Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 43200})
	writeJSON(w, 200, map[string]bool{"authenticated": true})
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, err := r.Cookie("departureboard"); err == nil {
		delete(s.sessions, c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: "departureboard", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode})
	writeJSON(w, 200, map[string]bool{"authenticated": false})
}
func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	if len(in.Password) < 8 || len(in.Password) > 128 {
		fail(w, 400, errors.New("use a password of 8–128 characters"))
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.savePassword(in.Password); err != nil {
		fail(w, 500, err)
		return
	}
	clear(s.sessions)
	writeJSON(w, 200, map[string]string{"message": "Board password changed. Sign in again."})
}
