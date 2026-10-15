package management

import (
	"net/http"
	"path/filepath"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/update"
)

func newUpdater(o Options) *update.Updater {
	in := update.Installer{
		Layout:     update.Layout{StateDir: o.StateDir},
		ConfigPath: o.ConfigPath,
		Key:        update.PublicKey(),
		Run:        update.Runner(o.Run),
		Settle:     20 * time.Second,
		Demo:       o.Demo,
	}
	// A demo installs updates into a directory instead of the system.
	if o.Demo {
		in.Root = filepath.Join(o.StateDir, "demo-root")
	}
	api := o.UpdateAPI
	if api == "" {
		api = "https://api.github.com"
	}
	return update.NewUpdater(in, &update.GitHub{API: api, Repo: o.UpdateRepo, Client: &http.Client{Timeout: 5 * time.Minute}})
}

func (s *Server) updateRoutes(api *http.ServeMux) {
	api.HandleFunc("GET /api/update/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, s.updater.Status())
	})
	api.HandleFunc("POST /api/update/check", func(w http.ResponseWriter, r *http.Request) {
		if err := s.updater.StartCheck(); err != nil {
			fail(w, 409, err)
			return
		}
		writeJSON(w, 202, map[string]string{"message": "Checking for updates."})
	})
	api.HandleFunc("POST /api/update/install", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			AllowOlder bool `json:"allowOlder"`
		}
		if !decode(w, r, &input) {
			return
		}
		if err := s.updater.StartInstall(input.AllowOlder); err != nil {
			fail(w, 409, err)
			return
		}
		writeJSON(w, 202, map[string]string{"message": "Downloading the update. The display and this page restart while it installs."})
	})
	api.HandleFunc("GET /api/update/settings", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, s.updater.Settings())
	})
	api.HandleFunc("PUT /api/update/settings", func(w http.ResponseWriter, r *http.Request) {
		var input update.Settings
		if !decode(w, r, &input) {
			return
		}
		if err := s.updater.SaveSettings(input); err != nil {
			fail(w, 400, err)
			return
		}
		writeJSON(w, 200, map[string]string{"message": "Update settings saved."})
	})
	api.HandleFunc("GET /api/update/commits", func(w http.ResponseWriter, r *http.Request) {
		commits, err := s.updater.Commits(r.Context())
		if err != nil {
			fail(w, 502, err)
			return
		}
		writeJSON(w, 200, commits)
	})
}
