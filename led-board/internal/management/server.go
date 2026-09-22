package management

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/configschema"
	"github.com/pelletier/go-toml/v2"
)

//go:embed web/*
var web embed.FS

type Runner func(context.Context, string, ...string) ([]byte, error)

func Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	for _, e := range os.Environ() {
		if !strings.HasPrefix(e, "BOARD_") && !strings.HasPrefix(e, "LC_ALL=") {
			cmd.Env = append(cmd.Env, e)
		}
	}
	cmd.Env = append(cmd.Env, "LC_ALL=C")
	return cmd.CombinedOutput()
}

type Options struct {
	ConfigPath, BoardBinary, StateDir, StatusPath, Interface string
	Demo                                                     bool
	Run                                                      Runner
}
type Server struct {
	opts        Options
	fields      []configschema.Field
	wifi        *WiFi
	mu          sync.Mutex
	sessions    map[string]time.Time
	password    passwordRecord
	loginWindow time.Time
	loginCount  int
}

func New(o Options) (*Server, error) {
	if o.Run == nil {
		o.Run = Run
	}
	if err := os.MkdirAll(o.StateDir, 0700); err != nil {
		return nil, err
	}
	s := &Server{opts: o, sessions: map[string]time.Time{}}
	data, err := o.Run(context.Background(), o.BoardBinary, "-config-schema")
	if err != nil {
		return nil, fmt.Errorf("read board configuration schema: %w: %s", err, data)
	}
	if err = json.Unmarshal(data, &s.fields); err != nil {
		return nil, err
	}
	if err = s.loadPassword(); err != nil {
		return nil, err
	}
	s.wifi = NewWiFi(o)
	return s, nil
}

func (s *Server) Start(ctx context.Context) { go s.wifi.Monitor(ctx) }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("GET /api/session", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]bool{"authenticated": s.authenticated(r)})
	})
	api := http.NewServeMux()
	api.HandleFunc("POST /api/logout", s.logout)
	api.HandleFunc("POST /api/password", s.changePassword)
	api.HandleFunc("GET /api/config", s.getConfig)
	api.HandleFunc("PUT /api/config", s.putConfig)
	api.HandleFunc("GET /api/status", func(w http.ResponseWriter, r *http.Request) {
		status := "unavailable"
		if s.opts.Demo {
			status = "demo"
		} else if data, err := s.opts.Run(r.Context(), "systemctl", "is-active", "departure-board.service"); err == nil {
			status = strings.TrimSpace(string(data))
		}
		writeJSON(w, 200, map[string]any{"network": s.wifi.Status(), "board": status, "demo": s.opts.Demo})
	})
	api.HandleFunc("GET /api/networks", func(w http.ResponseWriter, r *http.Request) {
		networks, err := s.wifi.Scan(r.Context())
		if err != nil {
			fail(w, 503, err)
			return
		}
		writeJSON(w, 200, networks)
	})
	api.HandleFunc("POST /api/network", func(w http.ResponseWriter, r *http.Request) {
		var input NetworkInput
		if !decode(w, r, &input) {
			return
		}
		if err := s.wifi.Connect(input); err != nil {
			fail(w, 400, err)
			return
		}
		writeJSON(w, 202, map[string]string{"message": "Connecting. Join your chosen Wi-Fi on this device, then open http://departureboard.local. If connection fails, the DepartureBoard hotspot returns."})
	})
	api.HandleFunc("POST /api/hotspot", func(w http.ResponseWriter, r *http.Request) {
		if err := s.wifi.Forget(); err != nil {
			fail(w, 409, err)
			return
		}
		writeJSON(w, 202, map[string]string{"message": "Join DepartureBoard with password DotMatrix, then open http://192.168.4.1."})
	})
	api.HandleFunc("POST /api/restart", func(w http.ResponseWriter, r *http.Request) {
		if !s.opts.Demo {
			if _, err := s.opts.Run(r.Context(), "systemctl", "restart", "departure-board.service"); err != nil {
				fail(w, 500, fmt.Errorf("could not restart the board"))
				return
			}
		}
		writeJSON(w, 200, map[string]string{"message": "Board restarted."})
	})
	mux.Handle("/api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.authenticated(r) {
			fail(w, 401, errors.New("sign in to manage the board"))
			return
		}
		api.ServeHTTP(w, r)
	}))
	assets, _ := fs.Sub(web, "web")
	mux.Handle("/", http.FileServer(http.FS(assets)))
	protected := http.NewCrossOriginProtection().Handler(mux)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		w.Header().Set("Cache-Control", "no-store")
		host := r.Host
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
		if host != "departureboard.local" && host != "departureboard" && host != "localhost" && net.ParseIP(host) == nil {
			fail(w, 403, errors.New("use departureboard.local or the board's IP address"))
			return
		}
		protected.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		fail(w, 415, errors.New("expected JSON"))
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		fail(w, 400, errors.New("invalid request"))
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		fail(w, 400, errors.New("expected one JSON value"))
		return false
	}
	return true
}
func revision(data []byte) string { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }

func (s *Server) getConfig(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.opts.ConfigPath)
	if err != nil {
		fail(w, 500, err)
		return
	}
	var values map[string]any
	if err = toml.Unmarshal(data, &values); err != nil {
		fail(w, 500, err)
		return
	}
	writeJSON(w, 200, map[string]any{"fields": s.fields, "values": values, "revision": revision(data)})
}

func (s *Server) putConfig(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Revision string         `json:"revision"`
		Values   map[string]any `json:"values"`
	}
	if !decode(w, r, &input) {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old, err := os.ReadFile(s.opts.ConfigPath)
	if err != nil {
		fail(w, 500, err)
		return
	}
	if input.Revision != revision(old) {
		fail(w, 409, errors.New("settings changed elsewhere; reload before saving"))
		return
	}
	if err = validateValues(input.Values, s.fields); err != nil {
		fail(w, 400, err)
		return
	}
	data, err := toml.Marshal(input.Values)
	if err != nil {
		fail(w, 400, err)
		return
	}
	data = append([]byte("# Managed by Departure Board. You can also edit this file on the SD card.\n"), data...)
	tmp, err := os.CreateTemp(s.opts.StateDir, "config-*.toml")
	if err != nil {
		fail(w, 500, err)
		return
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		fail(w, 500, err)
		return
	}
	tmp.Close()
	check, err := s.opts.Run(r.Context(), s.opts.BoardBinary, "-check-config", "-config", tmp.Name())
	if err != nil {
		fail(w, 400, fmt.Errorf("settings were not saved: %s", strings.TrimSpace(string(check))))
		return
	}
	if err = atomicWrite(s.opts.ConfigPath+".bak", old, 0644); err == nil {
		err = atomicWrite(s.opts.ConfigPath, data, 0644)
	}
	if err != nil {
		fail(w, 500, err)
		return
	}
	if !s.opts.Demo {
		if _, err = s.opts.Run(r.Context(), "systemctl", "restart", "departure-board.service"); err != nil {
			if restore := atomicWrite(s.opts.ConfigPath, old, 0644); restore != nil {
				fail(w, 500, fmt.Errorf("restart failed and settings could not be restored: %w", restore))
				return
			}
			s.opts.Run(context.Background(), "systemctl", "restart", "departure-board.service")
			fail(w, 500, errors.New("board restart failed; previous settings restored"))
			return
		}
	}
	writeJSON(w, 200, map[string]string{"message": "Settings saved. Board restarted.", "revision": revision(data)})
}

func validateValues(values map[string]any, fields []configschema.Field) error {
	known := map[string]configschema.Field{}
	for _, f := range fields {
		known[f.Key] = f
	}
	var visit func(map[string]any, string) error
	visit = func(values map[string]any, prefix string) error {
		for k, v := range values {
			name := prefix + k
			if name == "led" {
				table, ok := v.(map[string]any)
				if !ok {
					return errors.New("led must be a table")
				}
				if err := visit(table, "led."); err != nil {
					return err
				}
				continue
			}
			f, ok := known[name]
			if !ok {
				return fmt.Errorf("unknown setting %s", name)
			}
			valid := false
			switch f.Type {
			case "bool":
				_, valid = v.(bool)
			case "int":
				n, ok := v.(float64)
				valid = ok && math.Trunc(n) == n && math.Abs(n) <= 1e6
				if valid {
					values[k] = int64(n)
				}
			case "string":
				str, ok := v.(string)
				valid = ok && len(str) <= 2048
			case "stringSlice":
				a, ok := v.([]any)
				valid = ok && len(a) <= 100
				for _, item := range a {
					str, ok := item.(string)
					valid = valid && ok && len(str) <= 64
				}
			}
			if !valid {
				return fmt.Errorf("invalid value for %s", name)
			}
		}
		return nil
	}
	return visit(values, "")
}

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func (s *Server) passwordPath() string { return filepath.Join(s.opts.StateDir, "password.json") }
