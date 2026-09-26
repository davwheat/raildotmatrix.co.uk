package live

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/live/pb"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

func ptr[T any](v T) *T { return &v }

func at(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

// snapshotFixture is the snapshot raildotmatrix.co.uk's reducer tests start from, read through the same JSON
// form the fixtures use.
func snapshotFixture(t *testing.T) *Snapshot {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "snapshot.json"))
	if err != nil {
		t.Fatal(err)
	}
	var snapshot Snapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	return &snapshot
}

func updateFixture(t *testing.T, snapshot *Snapshot) *Update {
	t.Helper()
	return &Update{
		Version:          ProtocolVersion,
		Type:             "update",
		Epoch:            snapshot.Epoch,
		PreviousRevision: 1,
		Revision:         2,
		Window:           snapshot.Window,
		Upserts:          []Movement{},
		Removals:         []string{},
		Ordering:         snapshot.Ordering,
		OverrideUpserts:  []PlatformOverride{},
		OverrideRemovals: []OverrideRemoval{},
	}
}

func ids(services []model.Service) []string {
	out := make([]string, len(services))
	for i, service := range services {
		out[i] = service.ID
	}
	return out
}

// The .pb files are frames darwin-browser's own encoder wrote, and the .json beside each is the message it
// encoded. Copy both from its docs/live/fixtures when the schema changes.
func TestFixturesDecodeAsEncoded(t *testing.T) {
	frames, err := filepath.Glob(filepath.Join("testdata", "fixtures", "*.pb"))
	if err != nil || len(frames) == 0 {
		t.Fatalf("no fixtures: %v", err)
	}
	for _, path := range frames {
		name := strings.TrimSuffix(filepath.Base(path), ".pb")
		t.Run(name, func(t *testing.T) {
			frame, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			expected, err := os.ReadFile(strings.TrimSuffix(path, ".pb") + ".json")
			if err != nil {
				t.Fatal(err)
			}
			message, err := Decode(frame)
			if err != nil {
				t.Fatal(err)
			}
			decoded, err := json.Marshal(message)
			if err != nil {
				t.Fatal(err)
			}
			var got, want any
			if err := json.Unmarshal(decoded, &got); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(expected, &want); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("decoded message differs from the fixture\n got: %s\nwant: %s", decoded, expected)
			}
		})
	}
}

func TestAnotherVersionIsRefusedAndUnknownPayloadIgnored(t *testing.T) {
	frame, err := (&pb.ServerMessage{Version: 1, Payload: &pb.ServerMessage_Snapshot{Snapshot: &pb.CisSnapshot{}}}).MarshalVT()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Decode(frame); err == nil {
		t.Error("version 1 must be refused")
	}
	message, err := Decode([]byte{0x08, 0x02})
	if err != nil || message != nil {
		t.Errorf("a payload a newer service added is not an error: %v, %v", message, err)
	}
	var resync pb.ClientMessage
	if err := resync.UnmarshalVT(EncodeResync()); err != nil || resync.GetResync() == nil {
		t.Errorf("resync frame does not decode as a resync command: %v", err)
	}
}

func TestStateDigestGoldenVector(t *testing.T) {
	// The same vector is pinned by darwin-browser's TestStateDigestGoldenVector and raildotmatrix's live tests.
	got := StateDigest("epoch-1", 7, []string{"R2/b", "R1/a"}, []string{"R1/a", "R2/b"}, []string{"warn-2", "warn-1"})
	if got != "72e9ae2f95c1a7ae" {
		t.Errorf("digest = %s, want 72e9ae2f95c1a7ae", got)
	}
}

func TestReduceConvergesWithoutLosingOrderingOrVisits(t *testing.T) {
	initial := snapshotFixture(t)
	second := initial.Movements[0]
	second.ID, second.LocationID = "R1/second", "second"
	first := initial.Movements[0]
	first.OperatorName = nil
	update := updateFixture(t, initial)
	update.Upserts = []Movement{first, second}
	update.Ordering = []string{second.ID, first.ID}

	result := Reduce(Reduce(nil, initial), update)
	if result == nil || len(result.Movements) != 2 {
		t.Fatalf("update did not apply: %+v", result)
	}
	if result.Movements[first.ID].OperatorName != nil {
		t.Error("an upsert must replace the movement wholesale")
	}
	if !reflect.DeepEqual(result.Ordering, []string{second.ID, first.ID}) {
		t.Errorf("ordering = %v", result.Ordering)
	}
	if Reduce(result, updateFixture(t, initial)) != nil {
		t.Error("a stale previous revision must not apply")
	}
	rebuilt := updateFixture(t, initial)
	rebuilt.Epoch, rebuilt.PreviousRevision = "rebuilt", 2
	if Reduce(result, rebuilt) != nil {
		t.Error("another epoch must not apply")
	}
	snapshot := *initial
	snapshot.Epoch = "rebuilt"
	authoritative := Reduce(result, &snapshot)
	if len(authoritative.Movements) != 1 || authoritative.Epoch != "rebuilt" {
		t.Errorf("snapshot did not replace the state: %+v", authoritative)
	}
}

func TestReduceRemovalsSurviveResync(t *testing.T) {
	initial := snapshotFixture(t)
	override := PlatformOverride{
		ID: "warning", Kind: StandClear, Station: initial.Station, Platform: "2",
		ActivatesAt: initial.Window.From, ExpiresAt: initial.Window.To, Reason: "Passing train", Source: "TD",
	}
	withWarning := updateFixture(t, initial)
	withWarning.OverrideUpserts = []PlatformOverride{override}
	state := Reduce(Reduce(nil, initial), withWarning)
	if len(state.Overrides) != 1 {
		t.Fatalf("override not applied")
	}
	clearing := updateFixture(t, initial)
	clearing.PreviousRevision, clearing.Revision = 2, 3
	clearing.Removals = initial.Ordering
	clearing.Ordering = []string{}
	clearing.OverrideRemovals = []OverrideRemoval{{ID: override.ID, Reason: "cleared"}}
	cleared := Reduce(state, clearing)
	if len(cleared.Movements) != 0 || len(cleared.Overrides) != 0 {
		t.Errorf("removals not applied: %+v", cleared)
	}
	if len(state.Movements) != 1 {
		t.Error("reducing must not mutate the previous state")
	}
	resynced := *initial
	resynced.Revision, resynced.Movements, resynced.Ordering = 3, []Movement{}, []string{}
	if got := Reduce(cleared, &resynced); got.Digest() != cleared.Digest() {
		t.Errorf("resync digest %s differs from the reduced state %s", got.Digest(), cleared.Digest())
	}
}

func TestHeartbeatAttestsMatchingState(t *testing.T) {
	state := Reduce(nil, snapshotFixture(t))
	beat := func(values ...func(*Heartbeat)) *Heartbeat {
		h := &Heartbeat{Version: 2, Type: "heartbeat", Epoch: state.Epoch, Revision: state.Revision, Digest: state.Digest()}
		for _, apply := range values {
			apply(h)
		}
		return h
	}
	if !state.Attested(beat()) {
		t.Error("matching heartbeat must attest")
	}
	if state.Attested(beat(func(h *Heartbeat) { h.Revision++ })) {
		t.Error("another revision must not attest")
	}
	if state.Attested(beat(func(h *Heartbeat) { h.Epoch = "rebuilt" })) {
		t.Error("another epoch must not attest")
	}
	lost := *state
	lost.Movements = map[string]*Movement{}
	if lost.Attested(beat()) {
		t.Error("a lost movement must not pass on an unchanged revision")
	}
}

func TestStreamURL(t *testing.T) {
	cases := []struct {
		cfg  Config
		want string
	}{
		{Config{BaseURL: "ws://localhost:8080", CRS: "tst"}, "ws://localhost:8080/v1/cis/live?crs=TST&heartbeat=30"},
		{Config{BaseURL: "https://example.test/darwin/", CRS: "TST"}, "wss://example.test/darwin/v1/cis/live?crs=TST&heartbeat=30"},
		{
			Config{BaseURL: "http://example.test", CRS: "TST", Platforms: []string{"2", "1"}, ShowUnconfirmed: true},
			"ws://example.test/v1/cis/live?crs=TST&heartbeat=30&include_unconfirmed=true&platform=1%2C2",
		},
	}
	for _, c := range cases {
		got, err := StreamURL(c.cfg)
		if err != nil {
			t.Fatal(err)
		}
		if got.String() != c.want {
			t.Errorf("StreamURL(%+v) = %s, want %s", c.cfg, got, c.want)
		}
	}
	if _, err := StreamURL(Config{BaseURL: "file:///tmp", CRS: "TST"}); err == nil {
		t.Error("a file URL must be refused")
	}
}

func TestDisplayKeepsOrderingNamesAndSplitPortions(t *testing.T) {
	initial := snapshotFixture(t)
	first := &initial.Movements[0]
	first.Portions = []Portion{{
		RID: "R2", Category: "VV", At: first.CallingPoints[0].Location, Available: true,
		Destination: &first.Destinations[0].Location, CoachCount: ptr(int32(4)), Calls: first.CallingPoints,
	}}
	later := *first
	later.ID = "R3/call"
	later.Departure.Planned = ptr(at(t, "2026-09-13T10:20:00Z"))
	initial.Movements = append(initial.Movements, later)
	initial.Ordering = []string{later.ID, first.ID}
	state := Reduce(nil, initial)

	view := Display(state, Options{}, initial.Window.From)
	if !reflect.DeepEqual(ids(view.Services), initial.Ordering) {
		t.Errorf("services %v, want the server ordering %v", ids(view.Services), initial.Ordering)
	}
	service := view.Services[0]
	if service.Destinations[0].Name != "Destination from feed" || service.Destinations[0].Via != "via Junction" {
		t.Errorf("destination = %+v", service.Destinations[0])
	}
	if service.TOC != "Great Western Railway" || service.TOCCode != "GW" || service.Length != 8 || service.StartsHere {
		t.Errorf("service = %+v", service)
	}
	if first := view.Services[1]; first.STD(time.UTC) != "1005" || first.ETD(time.UTC) != "1010" {
		t.Errorf("times = %s %s", first.STD(time.UTC), first.ETD(time.UTC))
	}
	divides := service.CallPoints[0].Divides
	if len(divides) != 1 || divides[0].Length != 4 || len(divides[0].CallPoints) != 2 {
		t.Fatalf("divides = %+v", divides)
	}
	if got := Display(state, Options{LegacyTOCNames: true}, initial.Window.From).Services[0]; got.TOC != "First Great Western" || got.TOCCode != "GW" {
		t.Errorf("legacy TOC = %s (%s)", got.TOC, got.TOCCode)
	}

	first.Portions[0].Available = false
	if got := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[1].CallPoints[0].Divides; len(got) != 0 {
		t.Errorf("an unavailable portion must not divide: %+v", got)
	}
}

func TestDisplayLeavesJoiningPortionToTheTrainItBecomes(t *testing.T) {
	initial := snapshotFixture(t)
	main := &initial.Movements[0]
	portion := Portion{
		RID: "R2", Category: "JJ", At: main.Station, Available: true, Destination: &main.Destinations[0].Location,
		CoachCount: ptr(int32(5)), Calls: main.CallingPoints,
	}
	// The joining half terminates here; the service it joins departs with both portions' origins on it.
	joining := *main
	joining.ID = "R2/call"
	joining.Arrival = Times{Planned: ptr(at(t, "2026-09-13T10:00:00Z")), Estimated: ptr(at(t, "2026-09-13T10:02:00Z"))}
	joining.Departure = Times{}
	joining.Portions = []Portion{portion}
	main.Portions = []Portion{portion}
	terminating := joining
	terminating.ID = "R3/call"
	terminating.Portions = []Portion{}
	initial.Movements = append(initial.Movements, joining, terminating)
	initial.Ordering = []string{main.ID, joining.ID, terminating.ID}

	view := Display(Reduce(nil, initial), Options{ShowUnconfirmed: true}, initial.Window.From)
	if !reflect.DeepEqual(ids(view.Services), []string{main.ID, terminating.ID}) {
		t.Errorf("services = %v", ids(view.Services))
	}
	// A terminating service with no join of its own still says so, and is timed by its arrival.
	last := view.Services[1]
	if !last.TerminatesHere || last.Destinations[0].Name != "Terminates here" || last.STD(time.UTC) != "1000" || last.ETD(time.UTC) != "1002" {
		t.Errorf("terminating service = %+v", last)
	}

	initial.Movements[1].Portions[0].Available = false
	if got := Display(Reduce(nil, initial), Options{ShowUnconfirmed: true}, initial.Window.From).Services; len(got) != 3 {
		t.Errorf("an unavailable join leaves the portion on the board: %v", ids(got))
	}
}

func TestDisplayServiceFields(t *testing.T) {
	initial := snapshotFixture(t)
	m := &initial.Movements[0]
	m.Origins[0].CRS = ptr("TST")
	m.Departure.UnknownDelay = true
	m.Departure.Actual = ptr(at(t, "2026-09-13T10:12:00Z"))
	m.Arrival.Actual = ptr(at(t, "2026-09-13T10:04:00Z"))
	m.CancelReason.Text = ptr("a fault on the train")
	m.OperatorName, m.OperatorCode = nil, ptr("ZZ")
	state := Reduce(nil, initial)

	service := Display(state, Options{}, at(t, "2026-09-13T10:05:00Z")).Services[0]
	if service.Estimated != nil {
		t.Error("an unknown delay has no estimate")
	}
	if !service.Arrived || !service.StartsHere || service.Actual == nil || service.CancelReason != "a fault on the train" || service.TOC != "ZZ" {
		t.Errorf("service = %+v", service)
	}
	if service.ETD(time.UTC) != "1012" {
		t.Errorf("ETD = %s", service.ETD(time.UTC))
	}
	early := Display(state, Options{}, at(t, "2026-09-13T10:03:00Z")).Services[0]
	if early.Arrived {
		t.Error("a future actual arrival is not an arrival yet")
	}
	if next := NextBoundary(state, Options{}, at(t, "2026-09-13T10:03:00Z")); !next.Equal(*m.Arrival.Actual) {
		t.Errorf("next boundary = %s, want the arrival", next)
	}
}

func TestDisplayCallPointArrival(t *testing.T) {
	initial := snapshotFixture(t)
	calls := initial.Movements[0].CallingPoints
	planned, estimated, actual := at(t, "2026-09-13T10:30:00Z"), at(t, "2026-09-13T10:33:00Z"), at(t, "2026-09-13T10:31:00Z")
	calls[0].Arrival = Times{Planned: &planned}
	calls[1].Arrival = Times{Planned: &planned, Estimated: &estimated, Actual: &actual}

	points := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[0].CallPoints
	if got := points[0].Arrival; got == nil || !got.Equal(planned) {
		t.Errorf("planned only: arrival = %v, want %v", got, planned)
	}
	if got := points[1].Arrival; got == nil || !got.Equal(actual) {
		t.Errorf("actual outranks estimated: arrival = %v, want %v", got, actual)
	}

	calls[1].Arrival.Actual = nil
	if got := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[0].CallPoints[1].Arrival; got == nil || !got.Equal(estimated) {
		t.Errorf("estimated outranks planned: arrival = %v, want %v", got, estimated)
	}
	calls[1].Cancelled = true
	if got := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[0].CallPoints[1].Arrival; got != nil {
		t.Errorf("a cancelled call has no arrival, got %v", got)
	}
	calls[0].Arrival = Times{}
	if got := Display(Reduce(nil, initial), Options{}, initial.Window.From).Services[0].CallPoints[0].Arrival; got != nil {
		t.Errorf("a call with no times has no arrival, got %v", got)
	}
}

func TestPlatformAlterationsCrossTheWatchedPlatforms(t *testing.T) {
	initial := snapshotFixture(t)
	here := Reduce(nil, initial)
	moved := initial.Movements[0]
	moved.Platform.Number = ptr("5")
	update := updateFixture(t, initial)
	update.Upserts = []Movement{moved}
	away := Reduce(here, update)

	if got := PlatformAlterations(here, away, []string{"2"}); !reflect.DeepEqual(got, []string{moved.ID}) {
		t.Errorf("leaving the watched platform = %v", got)
	}
	if got := PlatformAlterations(away, here, []string{"2"}); !reflect.DeepEqual(got, []string{moved.ID}) {
		t.Errorf("a train moving onto the platform alters it too: %v", got)
	}
	if got := PlatformAlterations(here, away, []string{"2", "5"}); len(got) != 0 {
		t.Errorf("a move between watched platforms changes no row: %v", got)
	}
	if got := PlatformAlterations(here, away, nil); len(got) != 0 {
		t.Errorf("a board watching the whole station loses no train: %v", got)
	}
	if got := PlatformAlterations(nil, away, []string{"2"}); len(got) != 0 {
		t.Errorf("a board that has just connected has nothing to compare: %v", got)
	}

	unplatformed := *initial
	unplatformed.Movements = []Movement{initial.Movements[0]}
	unplatformed.Movements[0].Platform.Number = nil
	unknown := Reduce(nil, &unplatformed)
	if got := PlatformAlterations(unknown, here, []string{"2"}); len(got) != 0 {
		t.Errorf("a platform first published is not an alteration: %v", got)
	}
	if got := PlatformAlterations(here, unknown, []string{"2"}); len(got) != 0 {
		t.Errorf("a platform withdrawn is not an alteration: %v", got)
	}
	suppressed := moved
	suppressed.Suppressed = true
	update.Upserts = []Movement{suppressed}
	if got := PlatformAlterations(here, Reduce(here, update), []string{"2"}); len(got) != 0 {
		t.Errorf("a train no board lists is not an alteration: %v", got)
	}
}

func TestWarningsReplaceOnlyTheirPlatformAndExpire(t *testing.T) {
	initial := snapshotFixture(t)
	other := initial.Movements[0]
	other.ID = "other"
	other.Platform.Number = ptr("3")
	initial.Movements = append(initial.Movements, other)
	initial.Ordering = append(initial.Ordering, other.ID)
	initial.Overrides = []PlatformOverride{{
		ID: "warning", Kind: StandClear, Station: initial.Station, Platform: "2",
		ActivatesAt: initial.Window.From, ExpiresAt: at(t, "2026-09-13T10:01:00Z"), Reason: "TD", Source: "TD",
	}}
	state := Reduce(nil, initial)

	active := Display(state, Options{}, initial.Window.From)
	if !reflect.DeepEqual(ids(active.Services), []string{"other"}) || active.Notice != model.StandClear {
		t.Errorf("active warning: services %v, notice %v", ids(active.Services), active.Notice)
	}
	if active.NoticePlatform != "2" {
		t.Errorf("notice platform = %q, want 2", active.NoticePlatform)
	}
	if next := NextBoundary(state, Options{}, initial.Window.From); !next.Equal(at(t, "2026-09-13T10:01:00Z")) {
		t.Errorf("next boundary = %s, want the expiry", next)
	}
	expired := Display(state, Options{}, at(t, "2026-09-13T10:01:00Z"))
	if len(expired.Services) != 2 || expired.Notice != model.NoNotice {
		t.Errorf("expired warning: services %v, notice %v", ids(expired.Services), expired.Notice)
	}
	if got := Display(state, Options{Platforms: []string{"3"}}, initial.Window.From); got.Notice != model.NoNotice || len(got.Services) != 1 {
		t.Errorf("a warning on an unwatched platform: notice %v, services %v", got.Notice, ids(got.Services))
	}
	if next := NextBoundary(state, Options{Platforms: []string{"3"}}, initial.Window.From); !next.IsZero() {
		t.Errorf("an unwatched override schedules nothing, got %s", next)
	}

	state.Overrides["warning"].Kind = NotForPublicUse
	if got := Display(state, Options{}, initial.Window.From).Notice; got != model.NotForPublicUse {
		t.Errorf("notice = %v", got)
	}
	state.Overrides["pending"] = &PlatformOverride{
		ID: "pending", Kind: StandClear, Platform: "3", ActivatesAt: at(t, "2026-09-13T10:00:30Z"), ExpiresAt: at(t, "2026-09-13T10:02:00Z"),
	}
	if next := NextBoundary(state, Options{}, initial.Window.From); !next.Equal(at(t, "2026-09-13T10:00:30Z")) {
		t.Errorf("next boundary = %s, want the pending activation", next)
	}

	pending := at(t, "2026-09-13T10:00:30Z")
	if got := Display(state, Options{}, pending); got.Notice != model.StandClear || got.NoticePlatform != "3" {
		t.Errorf("a passing train outranks a non-public one: notice %v at %q", got.Notice, got.NoticePlatform)
	}
	state.Overrides["warning"].Kind = StandClear
	if got := Display(state, Options{}, pending); got.Notice != model.StandClear || got.NoticePlatform != "" {
		t.Errorf("warnings at two platforms name neither: notice %v at %q", got.Notice, got.NoticePlatform)
	}
}

func TestDisplayShowsPublishedPlatformsBeforeConfirmation(t *testing.T) {
	initial := snapshotFixture(t)
	template := initial.Movements[0]
	initial.Movements = nil
	initial.Ordering = nil
	for i := range 5 {
		m := template
		m.ID = "service-" + string(rune('0'+i))
		m.Platform = Platform{Number: ptr("2"), Confirmed: ptr(false), Suppressed: ptr(false)}
		initial.Movements = append(initial.Movements, m)
		initial.Ordering = append(initial.Ordering, m.ID)
	}
	state := Reduce(nil, initial)
	if got := Display(state, Options{Platforms: []string{"2"}}, initial.Window.From); !reflect.DeepEqual(ids(got.Services), initial.Ordering) {
		t.Errorf("services = %v", ids(got.Services))
	}
	if got := Display(state, Options{Platforms: []string{"3"}, ShowUnconfirmed: true}, initial.Window.From); len(got.Services) != 0 {
		t.Errorf("another platform's trains shown: %v", ids(got.Services))
	}

	initial.Movements[0].Platform.Suppressed = ptr(true)
	initial.Movements[1].Platform.Number = nil
	restricted := Reduce(nil, initial)
	if got := Display(restricted, Options{Platforms: []string{"2"}}, initial.Window.From); len(got.Services) != 3 {
		t.Errorf("unconfirmed hidden: %v", ids(got.Services))
	}
	got := Display(restricted, Options{Platforms: []string{"2"}, ShowUnconfirmed: true}, initial.Window.From)
	if len(got.Services) != 5 {
		t.Fatalf("unconfirmed shown: %v", ids(got.Services))
	}
	if platforms := []string{got.Services[0].Platform, got.Services[1].Platform, got.Services[2].Platform}; !reflect.DeepEqual(platforms, []string{"", "", "2"}) {
		t.Errorf("platforms = %q, want a suppressed or unknown platform left blank", platforms)
	}
}
