package live

import (
	"slices"
	"strings"
	"time"

	"github.com/davwheat/led-departure-board/internal/model"
)

// Options is the board's display policy. The service can narrow its payload to the same platforms, but that
// narrows what is sent; these rules decide what is shown.
type Options struct {
	// Platforms lists the platforms the board watches. Empty means the whole station.
	Platforms []string
	// ShowUnconfirmed keeps trains whose platform is unpublished or suppressed.
	ShowUnconfirmed bool
	// LegacyTOCNames prefers the operator names of the boards' era over the feed's.
	LegacyTOCNames bool
}

const terminatesHereName = "Terminates here"

// Display reduces a state to the view a board shows at the given moment. Alterations are left for the caller.
func Display(state *State, opts Options, now time.Time) model.View {
	selected := selectedPlatforms(opts.Platforms)
	overrides := activeOverrides(state, selected, now)
	overridden := make(map[string]bool, len(overrides))
	for _, override := range overrides {
		overridden[strings.ToUpper(override.Platform)] = true
	}

	services := make([]model.Service, 0, len(state.Ordering))
	for _, id := range state.Ordering {
		movement, held := state.Movements[id]
		if !held || !isPassengerCall(movement) {
			continue
		}
		platform := platformNumber(movement)
		if platform != "" && overridden[platform] {
			continue
		}
		// Darwin confirmation is separate from permission to display a platform: a published platform can be
		// shown before confirmation arrives.
		unconfirmed := platform == "" || (movement.Platform.Suppressed != nil && *movement.Platform.Suppressed)
		if unconfirmed && !opts.ShowUnconfirmed {
			continue
		}
		if selected != nil && (platform == "" || !selected[platform]) && !(unconfirmed && opts.ShowUnconfirmed) {
			continue
		}
		services = append(services, service(movement, opts.LegacyTOCNames, now))
	}
	return model.View{Connected: true, Services: services, Notice: notice(overrides)}
}

// PlatformAlterations lists the trains that have moved between a platform this board watches and one it doesn't.
// No board shows a platform number against a service, so an alteration reaches a passenger as a train appearing
// or vanishing: a move within the watched platforms changes nothing they can see, and a board watching the whole
// station never loses a train to one. A platform being published for the first time, or withdrawn, is an
// announcement rather than a move.
func PlatformAlterations(previous, next *State, platforms []string) []string {
	selected := selectedPlatforms(platforms)
	if previous == nil || next == nil || selected == nil {
		return nil
	}
	var altered []string
	for id, movement := range next.Movements {
		before, seen := previous.Movements[id]
		if !seen {
			continue
		}
		was, now := platformNumber(before), platformNumber(movement)
		if was == "" || now == "" || was == now || !isPassengerCall(movement) {
			continue
		}
		if selected[was] != selected[now] {
			altered = append(altered, id)
		}
	}
	slices.Sort(altered)
	return altered
}

// NextBoundary is the next moment at which the view changes without a message: an override activating or
// expiring on a watched platform, or a train's reported arrival time arriving. The zero time means never.
func NextBoundary(state *State, opts Options, now time.Time) time.Time {
	selected := selectedPlatforms(opts.Platforms)
	var next time.Time
	consider := func(t time.Time) {
		if t.After(now) && (next.IsZero() || t.Before(next)) {
			next = t
		}
	}
	for _, override := range state.Overrides {
		if selected != nil && !selected[strings.ToUpper(override.Platform)] {
			continue
		}
		consider(override.ActivatesAt)
		consider(override.ExpiresAt)
	}
	for _, movement := range state.Movements {
		if movement.Arrival.Actual != nil && isPassengerCall(movement) {
			consider(*movement.Arrival.Actual)
		}
	}
	return next
}

// notice picks the one warning that fits a board. A passing train is the more urgent of the two.
func notice(overrides []*PlatformOverride) model.Notice {
	if len(overrides) == 0 {
		return model.NoNotice
	}
	for _, override := range overrides {
		if override.Kind == StandClear {
			return model.StandClear
		}
	}
	return model.NotForPublicUse
}

func activeOverrides(state *State, selected map[string]bool, now time.Time) []*PlatformOverride {
	var active []*PlatformOverride
	for _, override := range state.Overrides {
		if selected != nil && !selected[strings.ToUpper(override.Platform)] {
			continue
		}
		if !override.ActivatesAt.After(now) && override.ExpiresAt.After(now) {
			active = append(active, override)
		}
	}
	return active
}

func selectedPlatforms(platforms []string) map[string]bool {
	if len(platforms) == 0 {
		return nil
	}
	selected := make(map[string]bool, len(platforms))
	for _, platform := range platforms {
		selected[strings.ToUpper(platform)] = true
	}
	return selected
}

func platformNumber(movement *Movement) string {
	if movement.Platform.Number == nil {
		return ""
	}
	return strings.ToUpper(*movement.Platform.Number)
}

// isPassengerCall reports whether a departure board can list the movement at all, before any platform filtering
// or override is considered.
func isPassengerCall(movement *Movement) bool {
	if movement.Suppressed || !movement.Passenger || movement.Operational {
		return false
	}
	// A terminating service is shown like any other, timed by its arrival. A train that only passes through is
	// not a call at all: it's announced, if at all, by a platform override.
	if movement.Departure.Planned == nil && (movement.Arrival.Planned == nil || movement.Kind == KindPassing) {
		return false
	}
	return !joinsHere(movement)
}

// A service ending its journey here has an arrival but no onward departure.
func terminatesHere(movement *Movement) bool {
	return movement.Departure.Planned == nil
}

// joinsHere finds a service that ends here only because it joins another one. That's the other train's portion
// rather than a working of its own: the service it becomes has its own entry, with both portions' origins on it,
// so showing this as well puts one train on the board twice, once as a train that terminates and strands its
// passengers, which is the opposite of what it does.
func joinsHere(movement *Movement) bool {
	if !terminatesHere(movement) {
		return false
	}
	for i := range movement.Portions {
		portion := &movement.Portions[i]
		if portion.Category == "JJ" && portion.Available && !portion.Cancelled && portion.At.TPL == movement.Station.TPL {
			return true
		}
	}
	return false
}

// boardTimes are what the board counts down to: a departure, or for a terminating service the arrival that
// passengers are waiting for.
func boardTimes(movement *Movement) *Times {
	if terminatesHere(movement) {
		return &movement.Arrival
	}
	return &movement.Departure
}

func service(movement *Movement, legacyNames bool, now time.Time) model.Service {
	times := boardTimes(movement)
	stationCRS := deref(movement.Station.CRS)
	s := model.Service{
		ID:             movement.ID,
		Origins:        locations(movement.Origins),
		TerminatesHere: terminatesHere(movement),
		Cancelled:      movement.Cancelled,
		CancelReason:   deref(movement.CancelReason.Text),
		DelayReason:    deref(movement.DelayReason.Text),
		Scheduled:      derefTime(times.Planned),
		Actual:         movement.Departure.Actual,
		Arrived:        movement.Arrival.Actual != nil && !movement.Arrival.Actual.After(now),
		Length:         int(derefInt(movement.CoachCount)),
		TOC:            operatorName(movement, legacyNames),
		CallPoints:     callPoints(movement.CallingPoints, movement),
	}
	if s.TerminatesHere {
		s.Destinations = []model.Location{{Name: terminatesHereName}}
	} else {
		s.Destinations = locations(movement.Destinations)
	}
	if !times.UnknownDelay {
		estimated := derefTime(times.Estimated)
		if times.Estimated == nil {
			estimated = s.Scheduled
		}
		s.Estimated = &estimated
	}
	for _, origin := range s.Origins {
		if origin.CRS == stationCRS {
			s.StartsHere = true
		}
	}
	return s
}

func operatorName(movement *Movement, legacyNames bool) string {
	if legacyNames && movement.OperatorCode != nil {
		if name := LegacyTOCName(*movement.OperatorCode); name != "" {
			return name
		}
	}
	if movement.OperatorName != nil && *movement.OperatorName != "" {
		return *movement.OperatorName
	}
	return deref(movement.OperatorCode)
}

func locations(endpoints []Endpoint) []model.Location {
	out := make([]model.Location, len(endpoints))
	for i := range endpoints {
		endpoint := &endpoints[i]
		out[i] = model.Location{Name: locationName(&endpoint.Location), CRS: deref(endpoint.CRS)}
		if endpoint.Via != nil {
			out[i].Via = endpoint.Via.Text
		}
	}
	return out
}

func locationName(location *Location) string {
	if location.Name != nil && *location.Name != "" {
		return *location.Name
	}
	if location.CRS != nil && *location.CRS != "" {
		return *location.CRS
	}
	return location.TPL
}

// callPoints keeps the passenger calls of a calling pattern. A portion dividing at a call is listed against it
// when the portion is available and has passenger calls of its own; movement is nil for a portion's own calls,
// which never divide again.
func callPoints(calls []Call, movement *Movement) []model.CallPoint {
	out := make([]model.CallPoint, 0, len(calls))
	for i := range calls {
		call := &calls[i]
		if !isPassengerCallPoint(call) {
			continue
		}
		point := model.CallPoint{
			Name:      locationName(&call.Location),
			Cancelled: call.Cancelled,
			Length:    int(derefInt(call.CoachCount)),
			Arrival:   arrivalTime(call),
		}
		if movement != nil {
			point.Divides = divisions(movement, call.TPL)
		}
		out = append(out, point)
	}
	return out
}

// arrivalTime mirrors CallPoint.displayedArrivalTime in ProcessServices.ts.
func arrivalTime(call *Call) *time.Time {
	if call.Cancelled {
		return nil
	}
	for _, t := range []*time.Time{call.Arrival.Actual, call.Arrival.Estimated, call.Arrival.Planned} {
		if t != nil {
			return t
		}
	}
	return nil
}

func isPassengerCallPoint(call *Call) bool {
	return call.CRS != nil && *call.CRS != "" && !call.Operational
}

func divisions(movement *Movement, tpl string) []model.Portion {
	var divides []model.Portion
	for i := range movement.Portions {
		portion := &movement.Portions[i]
		if portion.At.TPL != tpl || portion.Category != "VV" || !portion.Available || portion.Cancelled {
			continue
		}
		calls := callPoints(portion.Calls, nil)
		if len(calls) == 0 {
			continue
		}
		divides = append(divides, model.Portion{Length: int(derefInt(portion.CoachCount)), CallPoints: calls})
	}
	return divides
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func derefInt(value *int32) int32 {
	if value == nil {
		return 0
	}
	return *value
}

func derefTime(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return *value
}
