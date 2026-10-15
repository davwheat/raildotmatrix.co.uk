package update

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"math/rand/v2"
	"os"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/version"
)

type Settings struct {
	Channel string `json:"channel"`
	// Schedule is off, daily or weekly.
	Schedule string `json:"schedule"`
	// Time is the local time of a scheduled check, as HH:MM.
	Time string `json:"time"`
	// Weekday is the day of a weekly check, from 0 for Sunday.
	Weekday     int  `json:"weekday"`
	AutoInstall bool `json:"autoInstall"`
}

var timePattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

func (s Settings) Validate() error {
	if !slices.Contains([]string{Stable, Prerelease, Development}, s.Channel) {
		return errors.New("choose stable, prerelease or development updates")
	}
	if !slices.Contains([]string{"off", "daily", "weekly"}, s.Schedule) {
		return errors.New("choose off, daily or weekly checks")
	}
	if !timePattern.MatchString(s.Time) {
		return errors.New("enter the check time as HH:MM")
	}
	if s.Weekday < 0 || s.Weekday > 6 {
		return errors.New("choose a day of the week")
	}
	return nil
}

// Available describes the newest build on the board's channel.
type Available struct {
	Version     string    `json:"version"`
	Build       int       `json:"build"`
	Commit      string    `json:"commit"`
	Channel     string    `json:"channel"`
	Name        string    `json:"name"`
	Notes       string    `json:"notes"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"publishedAt"`
	// Newer is false when the channel is behind the installed build, which happens after switching from the
	// development channel. Such a build is installed only when someone asks for it.
	Newer     bool       `json:"newer"`
	UpToDate  bool       `json:"upToDate"`
	Download  int64      `json:"download"`
	Changes   []string   `json:"changes"`
	Conflicts []Conflict `json:"conflicts"`
	Missing   []string   `json:"missingPackages"`
}

type Status struct {
	Running   string     `json:"running"`
	Installed *Installed `json:"installed"`
	Settings  Settings   `json:"settings"`
	// Busy is checking, downloading or installing while the updater works.
	Busy       string     `json:"busy"`
	LastCheck  time.Time  `json:"lastCheck"`
	NextCheck  time.Time  `json:"nextCheck"`
	Error      string     `json:"error"`
	Available  *Available `json:"available"`
	LastResult *Result    `json:"lastResult"`
	CanVerify  bool       `json:"canVerify"`
}

type Installed struct {
	Version string `json:"version"`
	Build   int    `json:"build"`
	Commit  string `json:"commit"`
	Channel string `json:"channel"`
	Variant string `json:"variant"`
}

// state survives restarts, including the one each update causes.
type state struct {
	Releases  map[string]*cachedResponse `json:"releases"`
	LastCheck time.Time                  `json:"lastCheck"`
	NextCheck time.Time                  `json:"nextCheck"`
}

type Updater struct {
	Installer
	GitHub *GitHub
	Now    func() time.Time

	mu        sync.Mutex
	busy      string
	started   time.Time
	err       string
	available *Available
	release   Release
	target    *Manifest
	manifest  []byte
	signature []byte
	state     state
}

func NewUpdater(in Installer, gh *GitHub) *Updater {
	u := &Updater{Installer: in, GitHub: gh, Now: time.Now}
	if err := readJSON(u.State(), &u.state); err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("read update state: %v", err)
	}
	if u.state.Releases == nil {
		u.state.Releases = map[string]*cachedResponse{}
	}
	return u
}

func (u *Updater) Settings() Settings {
	s := Settings{Channel: Stable, Schedule: "daily", Time: "03:00"}
	// A board flashed from a prerelease or development image follows that channel until someone changes it.
	if m, err := u.LoadInstalled(); err == nil && slices.Contains([]string{Stable, Prerelease, Development}, m.Channel) {
		s.Channel = m.Channel
	}
	if err := readJSON(u.SettingsFile(), &s); err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("read update settings: %v", err)
	}
	return s
}

func (u *Updater) SaveSettings(s Settings) error {
	if err := s.Validate(); err != nil {
		return err
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	old := u.Settings()
	if err := writeJSON(u.SettingsFile(), s, 0600); err != nil {
		return err
	}
	if old.Channel != s.Channel {
		u.available, u.target, u.err = nil, nil, ""
	}
	u.state.NextCheck = u.nextCheck(u.Now(), s)
	return u.saveState()
}

func (u *Updater) saveState() error { return writeJSON(u.State(), u.state, 0600) }

func (u *Updater) Status() Status {
	u.mu.Lock()
	defer u.mu.Unlock()
	s := Status{
		Running:   version.String(),
		Settings:  u.Settings(),
		Busy:      u.busy,
		LastCheck: u.state.LastCheck,
		NextCheck: u.state.NextCheck,
		Error:     u.err,
		Available: u.available,
		CanVerify: u.Key != nil,
	}
	if s.Settings.Schedule == "off" {
		s.NextCheck = time.Time{}
	}
	if m, err := u.LoadInstalled(); err == nil {
		s.Installed = &Installed{Version: m.Version, Build: m.Build, Commit: m.Commit, Channel: m.Channel, Variant: m.Variant}
	}
	var r Result
	if err := readJSON(u.Result(), &r); err == nil {
		s.LastResult = &r
	}
	if u.installing() {
		s.Busy = "installing"
	} else if s.Busy == "installing" {
		s.Busy = ""
	}
	return s
}

// installing reports whether departure-board-update.service is working. It writes the applying marker, and then
// its result, some time after the manager starts it.
func (u *Updater) installing() bool {
	if _, err := os.Stat(u.Applying()); err == nil {
		return true
	}
	if u.busy != "installing" {
		return false
	}
	var last Result
	finished := readJSON(u.Result(), &last) == nil && !last.Time.Before(u.started)
	return !finished && u.Now().Sub(u.started) < 5*time.Minute
}

func (u *Updater) begin(task string) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.busy != "" && u.busy != "installing" || u.installing() {
		return errors.New("the updater is busy; try again in a moment")
	}
	u.busy, u.started, u.err = task, u.Now(), ""
	return nil
}

func (u *Updater) end(err error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if err != nil {
		u.err = err.Error()
		u.busy = ""
	} else if u.busy != "installing" {
		u.busy = ""
	}
}

// Check looks for a newer build on the board's channel and works out what installing it would change.
func (u *Updater) Check(ctx context.Context) error {
	if err := u.begin("checking"); err != nil {
		return err
	}
	err := u.check(ctx)
	u.end(err)
	return err
}

func (u *Updater) check(ctx context.Context) error {
	if u.Key == nil {
		return errors.New("this build can't check updates, because it has no signing key")
	}
	settings := u.Settings()
	installed, err := u.LoadInstalled()
	if err != nil {
		return fmt.Errorf("this board doesn't record which files it has: %w", err)
	}
	u.mu.Lock()
	cache := &cachedResponse{}
	if cached := u.state.Releases[settings.Channel]; cached != nil {
		*cache = *cached
	}
	u.mu.Unlock()
	release, err := u.GitHub.LatestRelease(ctx, settings.Channel, cache)
	if errors.Is(err, errNoRelease) {
		u.mu.Lock()
		u.available, u.target = nil, nil
		u.state.LastCheck = u.Now()
		u.mu.Unlock()
		return fmt.Errorf("%w on the %s channel", err, settings.Channel)
	}
	if err != nil {
		return err
	}
	manifest, signature, target, err := u.fetchManifest(ctx, release, installed.Variant)
	if err != nil {
		return err
	}
	if target.Variant != installed.Variant {
		return fmt.Errorf("the update is for %s boards, but this board is %s", target.Variant, installed.Variant)
	}
	p, err := MakePlan(u.Root, installed, target)
	if err != nil {
		return err
	}
	a := &Available{
		Version: target.Version, Build: target.Build, Commit: target.Commit, Channel: settings.Channel,
		Name: release.Name, Notes: release.Body, URL: release.URL, PublishedAt: release.PublishedAt,
		Newer:     target.Build > installed.Build,
		UpToDate:  target.Build == installed.Build && p.Empty(),
		Conflicts: p.Conflicts,
	}
	for _, name := range p.Assets() {
		a.Download += target.Assets[name].Size
	}
	a.Changes = paths(p)
	if len(p.Conflicts) > 0 {
		u.describeConflicts(ctx, release, target, a.Conflicts)
	}
	if !u.Demo {
		a.Missing = missingPackages(ctx, u.Run, target.Packages)
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.available, u.release, u.target, u.manifest, u.signature = a, release, target, manifest, signature
	u.state.Releases[settings.Channel] = cache
	u.state.LastCheck = u.Now()
	return u.saveState()
}

func (u *Updater) fetchManifest(ctx context.Context, release Release, variant string) ([]byte, []byte, *Manifest, error) {
	name := ManifestName(variant)
	manifestAsset, ok := release.Asset(name)
	signatureAsset, signed := release.Asset(name + ".sig")
	if !ok || !signed {
		return nil, nil, nil, fmt.Errorf("%s has no signed update for this kind of board", release.Tag)
	}
	var err error
	// CI replaces a development build's manifest and signature one after the other, so a board can download one
	// of each build. A second try a little later gets a matching pair.
	for attempt := range 2 {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, nil, nil, ctx.Err()
			case <-time.After(15 * time.Second):
			}
		}
		var manifest, signature []byte
		if manifest, err = u.GitHub.Download(ctx, manifestAsset.URL, 1<<20); err != nil {
			continue
		}
		if signature, err = u.GitHub.Download(ctx, signatureAsset.URL, 4096); err != nil {
			continue
		}
		var target *Manifest
		if target, err = VerifyManifest(manifest, signature, u.Key); err == nil {
			return manifest, signature, target, nil
		}
	}
	return nil, nil, nil, err
}

// describeConflicts adds a diff to each conflict in a text file that the release ships.
func (u *Updater) describeConflicts(ctx context.Context, release Release, target *Manifest, conflicts []Conflict) {
	unpacked := map[string]map[string][]byte{}
	for i, c := range conflicts {
		f, ok := target.File(c.Path)
		if !ok || !strings.HasSuffix(f.Asset, ".tar.xz") {
			continue
		}
		files, ok := unpacked[f.Asset]
		if !ok {
			var err error
			if files, err = fetchAsset(ctx, u.GitHub, release, f.Asset, target.Assets[f.Asset]); err != nil {
				log.Printf("download %s to compare edited files: %v", f.Asset, err)
			}
			unpacked[f.Asset] = files
		}
		disk, err := os.ReadFile(u.Root + c.Path)
		if err != nil || files == nil {
			continue
		}
		conflicts[i].Diff = Diff(c.Path+" in "+target.Version, files[f.Member], c.Path+" on this board", disk)
	}
}

// Install downloads the update found by the last check and hands it to departure-board-update.service. An update
// that isn't newer than the installed build is installed only if allowOlder is set.
func (u *Updater) Install(ctx context.Context, allowOlder bool) error {
	if err := u.begin("downloading"); err != nil {
		return err
	}
	err := u.install(ctx, allowOlder)
	u.end(err)
	return err
}

func (u *Updater) install(ctx context.Context, allowOlder bool) error {
	u.mu.Lock()
	a, release, target, manifest, signature := u.available, u.release, u.target, u.manifest, u.signature
	u.mu.Unlock()
	if a == nil || target == nil {
		return errors.New("check for updates first")
	}
	if a.UpToDate {
		return errors.New("this board is already up to date")
	}
	if !a.Newer && !allowOlder {
		return fmt.Errorf("%s is older than the installed version", target.Version)
	}
	installed, err := u.LoadInstalled()
	if err != nil {
		return err
	}
	p, err := MakePlan(u.Root, installed, target)
	if err != nil {
		return err
	}
	if len(p.Conflicts) > 0 {
		return conflictError(p.Conflicts)
	}
	if err := stage(ctx, u.Layout, u.Root, u.GitHub, release, target, manifest, signature, p); err != nil {
		return err
	}
	if err := preflight(ctx, u.Run, u.Layout, u.Root, u.ConfigPath, target, p, u.Demo); err != nil {
		os.RemoveAll(u.Staged())
		return err
	}
	u.mu.Lock()
	u.busy, u.started = "installing", u.Now()
	u.mu.Unlock()
	if u.Demo {
		go func() {
			u.Installer.Apply(context.Background())
			u.mu.Lock()
			u.busy, u.available = "", nil
			u.mu.Unlock()
		}()
		return nil
	}
	if out, err := u.Run(ctx, "systemctl", "start", "--no-block", UpdateUnit); err != nil {
		return fmt.Errorf("couldn't start the update: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// Commits lists what changed between the installed and available development builds.
func (u *Updater) Commits(ctx context.Context) ([]Commit, error) {
	u.mu.Lock()
	a := u.available
	u.mu.Unlock()
	installed, err := u.LoadInstalled()
	if err != nil {
		return nil, err
	}
	if a == nil || a.Commit == "" || installed.Commit == "" || !a.Newer {
		return []Commit{}, nil
	}
	return u.GitHub.Commits(ctx, installed.Commit, a.Commit)
}

// Resume finishes an update that the manager's restart interrupted. If the board lost power during an update,
// the update unit isn't running, so starting it rolls the update back.
func (u *Updater) Resume(ctx context.Context) {
	if _, err := os.Stat(u.Applying()); err != nil || u.Demo {
		return
	}
	state, _ := u.Run(ctx, "systemctl", "is-active", UpdateUnit)
	if s := strings.TrimSpace(string(state)); s == "active" || s == "activating" {
		return
	}
	log.Print("an update was interrupted; starting the update service to restore the previous version")
	if out, err := u.Run(ctx, "systemctl", "start", "--no-block", UpdateUnit); err != nil {
		log.Printf("start %s: %v: %s", UpdateUnit, err, out)
	}
}

// Schedule runs scheduled checks until ctx ends.
func (u *Updater) Schedule(ctx context.Context) {
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		u.scheduled(ctx)
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (u *Updater) scheduled(ctx context.Context) {
	settings := u.Settings()
	now := u.Now()
	// Without a real-time clock, a Pi can start with a clock from before this build. Checks wait until the clock
	// is set, because TLS fails and the schedule means nothing until then.
	if settings.Schedule == "off" || now.Before(version.CommitTime()) {
		return
	}
	u.mu.Lock()
	if u.state.NextCheck.IsZero() {
		u.state.NextCheck = u.nextCheck(now, settings)
		u.saveState()
	}
	due := !now.Before(u.state.NextCheck)
	u.mu.Unlock()
	if !due {
		return
	}
	err := u.Check(ctx)
	if err == nil && settings.AutoInstall {
		u.mu.Lock()
		a := u.available
		u.mu.Unlock()
		if a != nil && a.Newer && len(a.Conflicts) == 0 && len(a.Missing) == 0 {
			err = u.Install(ctx, false)
		}
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	next := u.nextCheck(now, settings)
	// Retry a failed check sooner, for example once the Wi-Fi is back, but not more often than every 15 minutes.
	if err != nil && !errors.Is(err, errNoRelease) {
		log.Printf("scheduled update check: %v", err)
		if retry := now.Add(15 * time.Minute); retry.Before(next) {
			next = retry
		}
	}
	u.state.NextCheck = next
	u.saveState()
}

// nextCheck returns the next scheduled time after now, up to 30 minutes late, so that boards don't all ask GitHub
// at once.
func (u *Updater) nextCheck(now time.Time, s Settings) time.Time {
	return NextSlot(now, s).Add(time.Duration(rand.Int64N(int64(30 * time.Minute))))
}

func NextSlot(now time.Time, s Settings) time.Time {
	var hour, minute int
	fmt.Sscanf(s.Time, "%d:%d", &hour, &minute)
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
	for !next.After(now) || s.Schedule == "weekly" && int(next.Weekday()) != s.Weekday {
		next = next.AddDate(0, 0, 1)
	}
	return next
}

// StartCheck checks for updates in the background, so that a web request returns at once.
func (u *Updater) StartCheck() error {
	if err := u.begin("checking"); err != nil {
		return err
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		u.end(u.check(ctx))
	}()
	return nil
}

// StartInstall downloads and installs the available update in the background.
func (u *Updater) StartInstall(allowOlder bool) error {
	if err := u.begin("downloading"); err != nil {
		return err
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		u.end(u.install(ctx, allowOlder))
	}()
	return nil
}
