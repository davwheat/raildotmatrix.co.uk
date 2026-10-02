package live

import (
	"slices"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Options is the board's display policy. The service can narrow its payload to the same platforms, but that
// narrows what is sent; these rules decide what is shown.
type Options struct {
	// Platforms lists the platforms the board watches. Empty means the whole station.
	Platforms []string
	// ShowUnconfirmed keeps trains whose platform is unpublished or suppressed.
	ShowUnconfirmed bool
	// HideTerminating excludes services that end their journey at this station.
	HideTerminating bool
	// LegacyTOCNames prefers the operator names of the boards' era over the feed's.
	LegacyTOCNames bool
	// MaxServices bounds projection work to the rows the renderer can show. Non-positive means unlimited.
	MaxServices int
}

const terminatesHereName = "Terminates here"

// Display reduces a state to the view a board shows at the given moment. Alterations are left for the caller.
func Display(state *State, opts Options, now time.Time) model.View {
	capacity := len(state.Ordering)
	if opts.MaxServices > 0 {
		capacity = min(capacity, opts.MaxServices)
	}
	services := make([]model.Service, 0, capacity)

	n, platform := visitServices(state, opts, now, func(movement *Movement, platform string) {
		s := service(movement, opts.LegacyTOCNames, now)
		if movement.Platform.Suppressed == nil || !*movement.Platform.Suppressed {
			s.Platform = platform
		}
		services = append(services, s)
	})
	return model.View{Connected: true, Services: services, Notice: n, NoticePlatform: platform}
}

// visitServices applies one filtering policy for pure and cached projections.
// The visitor runs only for the selected services, in their display order.
func visitServices(state *State, opts Options, now time.Time, visit func(*Movement, string)) (model.Notice, string) {
	selected := selectedPlatforms(opts.Platforms)
	overrides := activeOverrides(state, selected, now)
	overridden := make(map[string]bool, len(overrides))
	for _, override := range overrides {
		overridden[strings.ToUpper(override.Platform)] = true
	}

	count := 0
	for _, id := range state.Ordering {
		movement, held := state.Movements[id]
		if !held || !isPassengerCall(movement) {
			continue
		}
		if opts.HideTerminating && terminatesHere(movement) {
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
		visit(movement, platform)
		count++
		if opts.MaxServices > 0 && count == opts.MaxServices {
			break
		}
	}
	return notice(overrides)
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
		// Shared movements are immutable, so their platform cannot have changed.
		if !seen || before == movement {
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

// Delta messages can only change platforms through their upserts. The final state identifies the last occurrence of
// a repeated upsert ID, exactly as Reduce does; removals alone are not moves.
func deltaPlatformAlterations(previous, next *State, platforms []string, message Message) []string {
	update, delta := message.(*Update)
	if !delta {
		return PlatformAlterations(previous, next, platforms)
	}
	if previous == nil || next == nil || len(update.Upserts) == 0 || len(platforms) == 0 {
		return nil
	}
	selected := selectedPlatforms(platforms)
	var altered []string
	for i := range update.Upserts {
		movement := &update.Upserts[i]
		if next.Movements[movement.ID] != movement {
			continue
		}
		before, seen := previous.Movements[movement.ID]
		if !seen || before == movement {
			continue
		}
		was, now := platformNumber(before), platformNumber(movement)
		if was == "" || now == "" || was == now || !isPassengerCall(movement) {
			continue
		}
		if selected[was] != selected[now] {
			altered = append(altered, movement.ID)
		}
	}
	slices.Sort(altered)
	return altered
}

// NextBoundary is the next moment at which the view changes without a message: an override activating or
// expiring on a watched platform, or a train's reported arrival time arriving. The zero time means never.
func NextBoundary(state *State, opts Options, now time.Time) time.Time {
	return nextBoundary(state, opts, now, nil)
}

// A projected view can only change when one of its services arrives or an
// override starts/expires. Hidden services are re-evaluated on the next feed or
// override change. Nil retains NextBoundary's conservative whole-state scan.
func nextBoundary(state *State, opts Options, now time.Time, visible []model.Service) time.Time {
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
	if visible != nil {
		for _, service := range visible {
			if movement := state.Movements[service.ID]; movement != nil && movement.Arrival.Actual != nil {
				consider(*movement.Arrival.Actual)
			}
		}
	} else {
		for _, movement := range state.Movements {
			if movement.Arrival.Actual != nil && isPassengerCall(movement) && !(opts.HideTerminating && terminatesHere(movement)) {
				consider(*movement.Arrival.Actual)
			}
		}
	}
	return next
}

// notice picks the one warning that fits a board, and the platform it's for when every override of that kind
// is on the same one. A passing train is the more urgent of the two.
func notice(overrides []*PlatformOverride) (model.Notice, string) {
	if len(overrides) == 0 {
		return model.NoNotice, ""
	}
	n, kind := model.NotForPublicUse, NotForPublicUse
	for _, override := range overrides {
		if override.Kind == StandClear {
			n, kind = model.StandClear, StandClear
		}
	}
	platform := ""
	for _, override := range overrides {
		if override.Kind != kind {
			continue
		}
		p := strings.ToUpper(override.Platform)
		if platform != "" && p != platform {
			return n, ""
		}
		platform = p
	}
	return n, platform
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
	advertised := advertisedJourney(movement)
	s := model.Service{
		ID:             movement.ID,
		Origins:        locations(movement.Origins),
		TerminatesHere: terminatesHere(movement),
		Bus:            movement.Mode == ModeBus,
		Cancelled:      movement.Cancelled,
		CancelReason:   deref(movement.CancelReason.Text),
		DelayReason:    deref(movement.DelayReason.Text),
		Scheduled:      derefTime(times.Planned),
		Actual:         movement.Departure.Actual,
		Arrived:        movement.Arrival.Actual != nil && !movement.Arrival.Actual.After(now),
		Length:         int(derefInt(movement.CoachCount)),
		Coaches:        formationCoaches(movement.Coaches),
		TOC:            operatorName(movement, legacyNames),
		TOCCode:        deref(movement.OperatorCode),
		CallPoints:     callPoints(advertised.calls, movement.Portions, movement.Cancelled),
	}
	for _, linked := range advertised.linked {
		s.CallPoints = append(s.CallPoints, callPoints(linked.calls, linked.portions, movement.Cancelled)...)
	}
	if len(s.Coaches) > 0 {
		s.Length = len(s.Coaches)
	}
	if s.TerminatesHere {
		s.Destinations = []model.Location{{Name: terminatesHereName}}
	} else {
		s.Destinations = locations(advertisedDestinations(movement, advertised))
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

// journey is what the board advertises of a movement's journey.
type journey struct {
	// calls are the movement's own calls that the board lists.
	calls []Call
	// linked are the services linked on from the last of those, in order.
	linked []leg
	// linkedDestination is where the last linked service goes, or nil when nothing is linked.
	linkedDestination *Location
}

// leg is the part of a journey that one linked service runs.
type leg struct {
	calls []Call
	// portions are what the feed sends of that service's own associations. For a train that a portion joined,
	// they include the portions that divide from it afterwards.
	portions []Portion
}

// advertisedJourney shows a service linked to another where it ends as one through service: the calls of each
// linked service follow its own, and the last one's destination replaces its own. Links carry on through as many
// services as the feed sends, such as a train, a bus, and then a train. A portion that joins another train is
// shown in the same way, as a through service to where that train goes.
//
// A false destination ends the calling pattern instead. It ends at the first call there, because a train on a
// circular route calls there again on its way to the real destination. Darwin sets one to say what a board shows,
// so no link is followed past it.
func advertisedJourney(movement *Movement) journey {
	if movement.FalseDestination != nil {
		for i := range movement.CallingPoints {
			if sameStation(&movement.CallingPoints[i].Location, movement.FalseDestination) {
				return journey{calls: movement.CallingPoints[:i+1]}
			}
		}
		return journey{calls: movement.CallingPoints}
	}
	link, from, calls := onwardLink(movement.Portions, movement.CallingPoints)
	if link == nil {
		return journey{calls: movement.CallingPoints}
	}
	j := journey{calls: movement.CallingPoints[:from+1]}
	for link != nil {
		j.linkedDestination = link.Destination
		if j.linkedDestination == nil {
			j.linkedDestination = &calls[len(calls)-1].Location
		}
		next, from, onward := onwardLink(link.Links, calls)
		if next != nil {
			calls = calls[:from+1]
		}
		j.linked = append(j.linked, leg{calls: calls, portions: link.Links})
		link, calls = next, onward
	}
	return j
}

// onwardLink finds the portion that takes a service's passengers on from the call where it ends, the index of
// that call, and the linked service's calls after it. Darwin links two services to make one journey of them, most
// often a train and the rail replacement bus that finishes its route, and a bus recorded as a train's next working
// means the same. A link anywhere else on the route is a change that the service runs on past, so it's left alone.
// Main is false on the service the passengers came from.
//
// A portion that joins another train ends where it joins, and its passengers stay on board, so the train it joins
// takes them on as well. There Main is false on the portion that joins, and the join can be a call that
// passengers can't use.
func onwardLink(portions []Portion, calls []Call) (*Portion, int, []Call) {
	ends := len(calls) - 1
	for ends >= 0 && calls[ends].Cancelled {
		ends--
	}
	from := ends
	for from >= 0 && !running(&calls[from]) {
		from--
	}
	for i := range portions {
		link := &portions[i]
		if !link.Available || link.Cancelled {
			continue
		}
		associated := link.Main != nil && !*link.Main
		bus := link.Mode != nil && *link.Mode == ModeBus
		from := from
		switch {
		case link.Category == "JJ" && (associated || link.Main == nil):
			from = ends
		case associated:
			continue
		case link.Category == "LK", link.Category == "NP" && bus:
		default:
			continue
		}
		if from < 0 || !sameStation(&link.At, &calls[from].Location) {
			continue
		}
		joins := slices.IndexFunc(link.Calls, func(call Call) bool { return sameStation(&call.Location, &link.At) })
		if joins == -1 {
			continue
		}
		onward := link.Calls[joins+1:]
		// A linked service that runs nowhere from here takes nobody on.
		if slices.ContainsFunc(onward, func(call Call) bool { return running(&call) }) {
			return link, from, onward
		}
	}
	return nil, 0, nil
}

// running reports whether the service makes a call, as opposed to one that is cancelled or that passengers can't
// use.
func running(call *Call) bool {
	return !call.Cancelled && !call.Operational
}

// advertisedDestinations names a false destination in place of the service's own: the station Darwin tells a
// board to show instead of the real one, as on a circular route. A linked service's destination replaces it in
// the same way. Either has no via caption, because the feed's caption describes the route to the service's own
// destination. The destinations of portions are kept while a portion still divides off for them: the feed lists
// one for as long as the division stands, which includes a portion that no longer runs anywhere.
func advertisedDestinations(movement *Movement, advertised journey) []Endpoint {
	shown := movement.FalseDestination
	if shown == nil {
		shown = advertised.linkedDestination
	}
	out := make([]Endpoint, 0, len(movement.Destinations))
	if shown != nil {
		out = append(out, Endpoint{Location: *shown})
	}
	for i := range movement.Destinations {
		destination := &movement.Destinations[i]
		if rid := deref(destination.AssocRID); rid != "" {
			if dividesOff(movement, rid) {
				out = append(out, *destination)
			}
		} else if shown == nil {
			out = append(out, *destination)
		}
	}
	// The feed lists the destinations of the movement's own portions. Those of a train that it joins come with
	// that train.
	for _, linked := range advertised.linked {
		for i := range linked.portions {
			portion := &linked.portions[i]
			reached := slices.ContainsFunc(linked.calls, func(call Call) bool { return call.TPL == portion.At.TPL })
			if portion.Category != "VV" || !reached {
				continue
			}
			if calls := portionCalls(portion, movement.Cancelled); calls != nil {
				destination := Endpoint{Location: portion.Calls[len(portion.Calls)-1].Location}
				if portion.Destination != nil {
					destination.Location = *portion.Destination
				}
				out = append(out, destination)
			}
		}
	}
	return out
}

// dividesOff reports whether passengers can still travel in the portion that an associated destination belongs
// to. An endpoint whose portion the feed didn't send is taken at its word.
func dividesOff(movement *Movement, rid string) bool {
	sent := false
	for i := range movement.Portions {
		portion := &movement.Portions[i]
		if portion.RID != rid || portion.Category != "VV" {
			continue
		}
		sent = true
		if portionCalls(portion, movement.Cancelled) != nil {
			return true
		}
	}
	return !sent
}

// sameStation allows for a false destination or a link, and a call, that name one station by different TIPLOCs.
func sameStation(a, b *Location) bool {
	return a.TPL == b.TPL || (deref(a.CRS) != "" && deref(a.CRS) == deref(b.CRS))
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

// locations names each endpoint. The feed sends the endpoint of a portion it knows nothing about with no location,
// which the board has no name to show for, so it's left out.
func locations(endpoints []Endpoint) []model.Location {
	out := make([]model.Location, 0, len(endpoints))
	for i := range endpoints {
		endpoint := &endpoints[i]
		location := model.Location{Name: locationName(&endpoint.Location), CRS: deref(endpoint.CRS), Departs: endpoint.PlannedDeparture}
		if location.Name == "" {
			continue
		}
		if endpoint.Via != nil {
			location.Via = endpoint.Via.Text
		}
		out = append(out, location)
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

// callPoints keeps the passenger calls of a train's calling pattern. A portion dividing at a call is listed
// against it when the portion is available and has passenger calls of its own, and so are coaches that the train
// leaves behind there. portions are those of the service that makes the calls.
//
// A train can divide at a station where it sets nobody down, as a sleeper does. The division still has to be
// listed against a call, so that call is kept, as it is by processServices in ProcessServices.ts.
//
// A call that the train no longer makes is left out, unless the train is cancelled here too: then cancelled says
// so, and the board lists the journey that it would have made.
func callPoints(calls []Call, portions []Portion, cancelled bool) []model.CallPoint {
	return listCalls(calls, portions, cancelled, true)
}

// listCalls is callPoints for a train, which can divide, and for a portion that has divided off, which never
// divides again.
func listCalls(calls []Call, portions []Portion, cancelled, divides bool) []model.CallPoint {
	out := make([]model.CallPoint, 0, len(calls))
	// The feed names the end of a train as it arrives at a call. Each reversal on the way there swaps the ends,
	// so that end is the other one as the train stands here.
	turned := false
	for i := range calls {
		call := &calls[i]
		if call.Cancelled && !cancelled {
			continue
		}
		passenger := isPassengerCallPoint(call)
		var leaving []model.Portion
		if divides && deref(call.CRS) != "" {
			leaving = divisions(portions, call, cancelled)
			if len(leaving) == 0 && passenger {
				leaving = leftBehind(call)
			}
			for j := range leaving {
				if turned {
					leaving[j].Position = otherEnd(leaving[j].Position)
				}
			}
		}
		if hasActivity(call.Activities, "RM") {
			turned = !turned
		}
		if !passenger && len(leaving) == 0 {
			continue
		}
		out = append(out, model.CallPoint{
			Name:      locationName(&call.Location),
			Cancelled: call.Cancelled,
			Length:    int(derefInt(call.CoachCount)),
			Arrival:   arrivalTime(call),
			Divides:   leaving,
		})
	}
	return out
}

// leftBehind is the coaches that a train leaves at a call while it runs on as the same service. They go no
// further, so they have no calls of their own.
func leftBehind(call *Call) []model.Portion {
	if call.FormationChange == nil || call.FormationChange.Detached == nil {
		return nil
	}
	detached := call.FormationChange.Detached
	return []model.Portion{{Length: int(derefInt(detached.Coaches)), Position: trainEnd(detached.Position)}}
}

// trainEnd is an end of a train that the board has a name for, or empty.
func trainEnd(position *string) string {
	switch end := deref(position); end {
	case "front", "middle", "rear":
		return end
	}
	return ""
}

func otherEnd(position string) string {
	switch position {
	case "front":
		return "rear"
	case "rear":
		return "front"
	}
	return position
}

// hasActivity looks for one of Darwin's two-character activity codes, so that "R" doesn't match within "RM".
func hasActivity(activities *string, code string) bool {
	if activities == nil {
		return false
	}
	for i := 0; i < len(*activities); i += 2 {
		if strings.TrimSpace((*activities)[i:min(i+2, len(*activities))]) == code {
			return true
		}
	}
	return false
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

// divisions lists the portions that divide from a train at a call, each with the end of the train that it is at
// as the train arrives. The feed works that out from the way the train leaves. Where it doesn't, Darwin says only
// which end of the train stock detaches from, which can't tell two portions apart.
func divisions(portions []Portion, call *Call, cancelled bool) []model.Portion {
	var divides []model.Portion
	for i := range portions {
		portion := &portions[i]
		if portion.At.TPL != call.TPL || portion.Category != "VV" {
			continue
		}
		if calls := portionCalls(portion, cancelled); calls != nil {
			divides = append(divides, model.Portion{Length: int(derefInt(portion.CoachCount)), Position: trainEnd(portion.Position), CallPoints: calls})
		}
	}
	if len(divides) == 1 && divides[0].Position == "" && call.DetachFront != nil {
		divides[0].Position = "rear"
		if *call.DetachFront {
			divides[0].Position = "front"
		}
	}
	return divides
}

// portionCalls are the calls of a portion that divides off, from the division. They're nil for a portion that
// passengers can't travel in: one that doesn't run, that the feed knows nothing about, or that has nowhere left
// to call.
func portionCalls(portion *Portion, cancelled bool) []model.CallPoint {
	if !portion.Available || portion.Cancelled {
		return nil
	}
	onward := portion.Calls
	if from := slices.IndexFunc(onward, func(call Call) bool { return sameStation(&call.Location, &portion.At) }); from != -1 {
		onward = onward[from:]
	}
	calls := listCalls(onward, nil, cancelled, false)
	if len(calls) == 0 || (len(calls) == 1 && calls[0].Name == locationName(&portion.At)) {
		return nil
	}
	return calls
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

// The structured feed supplies class, toilets, per-coach loads and optional
// wheelchair-space and cycle-space flags enriched from Gemini allocations.
func formationCoaches(coaches []Coach) []model.Coach {
	result := make([]model.Coach, len(coaches))
	for i, c := range coaches {
		load := -1
		if c.LoadingPercent != nil {
			load = min(100, max(0, int(*c.LoadingPercent)))
		}
		class := strings.ToLower(deref(c.Class))
		toilet := strings.ToLower(deref(c.ToiletType))
		result[i] = model.Coach{Label: c.Number, Loading: load,
			FirstClass: class == "first" || class == "mixed",
			Accessible: (c.Accessible != nil && *c.Accessible) || toilet == "accessible",
			Cycles:     c.CycleSpaces != nil && *c.CycleSpaces,
			Toilet:     toilet == "standard" || toilet == "accessible",
			Food:       c.Food != nil && *c.Food,
		}
	}
	return result
}
