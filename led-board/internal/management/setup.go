package management

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/atomicfile"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/testpattern"
	"github.com/pelletier/go-toml/v2"
)

// setupSteps are the steps of first-time setup in order, and then "done". Wi-Fi comes last, because joining a
// network takes the board off the setup hotspot, and the browser with it.
var setupSteps = []string{"panels", "colours", "station", "wifi", "done"}

// testPatternTime is how long a test pattern shows unless setup moves on, so that an abandoned setup doesn't leave
// the board showing one.
const testPatternTime = 10 * time.Minute

type setupState struct {
	Step string `json:"step"`
}

func (s *Server) setupPath() string { return filepath.Join(s.opts.StateDir, "setup.json") }

func (s *Server) loadSetup() error {
	var state setupState
	data, err := os.ReadFile(s.setupPath())
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err == nil && json.Unmarshal(data, &state) == nil && slices.Contains(setupSteps, state.Step) {
		s.setupStep = state.Step
		return nil
	}
	s.setupStep = setupSteps[0]
	if errors.Is(err, os.ErrNotExist) && s.configuredStation() {
		// The board was set up before the setup steps existed, or by editing the config file on the SD card.
		return s.saveSetup("done")
	}
	return nil
}

func (s *Server) configuredStation() bool {
	data, err := os.ReadFile(s.opts.ConfigPath)
	if err != nil {
		return false
	}
	var values struct {
		CRS string `toml:"crs"`
	}
	return toml.Unmarshal(data, &values) == nil && values.CRS != ""
}

func (s *Server) saveSetup(step string) error {
	data, _ := json.Marshal(setupState{Step: step})
	if err := atomicfile.Write(s.setupPath(), data, 0600); err != nil {
		return err
	}
	s.setupStep = step
	return nil
}

func (s *Server) setupRoutes(api *http.ServeMux) {
	api.HandleFunc("PUT /api/setup", func(w http.ResponseWriter, r *http.Request) {
		var in setupState
		if !decode(w, r, &in) {
			return
		}
		if !slices.Contains(setupSteps, in.Step) {
			fail(w, 400, errors.New("unknown setup step"))
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if err := s.saveSetup(in.Step); err != nil {
			fail(w, 500, err)
			return
		}
		writeJSON(w, 200, map[string]string{"setupStep": in.Step})
	})
	api.HandleFunc("POST /api/test-pattern", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Pattern string `json:"pattern"`
		}
		if !decode(w, r, &in) {
			return
		}
		if in.Pattern != "" && !slices.Contains(testpattern.Names, in.Pattern) {
			fail(w, 400, errors.New("unknown test pattern"))
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if err := s.writeTestPattern(in.Pattern); err != nil {
			fail(w, 500, err)
			return
		}
		if !s.opts.Demo {
			if _, err := s.opts.Run(r.Context(), "systemctl", "kill", "--signal=SIGUSR1", "departure-board.service"); err != nil {
				fail(w, 503, errors.New("the display isn't running; restart it from the Device tab"))
				return
			}
		}
		writeJSON(w, 200, map[string]string{"pattern": in.Pattern})
	})
	api.HandleFunc("POST /api/colour-order", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Current string `json:"current"`
			Seen    string `json:"seen"`
		}
		if !decode(w, r, &in) {
			return
		}
		sequence, err := matrix.CorrectSequence(in.Current, in.Seen)
		if err != nil {
			fail(w, 400, err)
			return
		}
		writeJSON(w, 200, map[string]string{"sequence": sequence})
	})
}

// writeTestPattern asks the board to show pattern, or the board itself when pattern is empty. The board reads the
// request when it starts and whenever it's signalled.
func (s *Server) writeTestPattern(pattern string) error {
	path := testpattern.Path(s.opts.StatusPath)
	if pattern == "" {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}
	data, _ := json.Marshal(testpattern.Request{Pattern: pattern, Until: time.Now().Add(testPatternTime)})
	return atomicfile.Write(path, data, 0644)
}
