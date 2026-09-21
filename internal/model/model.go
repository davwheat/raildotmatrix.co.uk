// Package model is the contract between the live feed and the board: what a departure board needs to know about
// each train, already reduced from the Darwin Browser movement feed. It mirrors IMyTrainService in
// raildotmatrix.co.uk's src/api/ProcessServices.ts, keeping only what the Data Display board reads.
package model

import "time"

// Location is a named place on a train's journey.
type Location struct {
	Name string
	CRS  string
	// Via is the "via X" text for a destination, or empty.
	Via string
}

// Portion is part of a dividing train that goes its own way from a calling point.
type Portion struct {
	// Length is the coach count, or 0 when unknown.
	Length     int
	CallPoints []CallPoint
}

// CallPoint is a passenger stop after this station.
type CallPoint struct {
	Name      string
	Cancelled bool
	// Length is the coach count on departure from this call, or 0 when unknown.
	Length int
	// Divides lists the portions that split off here.
	Divides []Portion
}

// Service is one train on the board.
type Service struct {
	ID string
	// Destinations is empty only for a service with no known destination; a terminating service has one
	// destination named "Terminates here".
	Destinations   []Location
	Origins        []Location
	TerminatesHere bool
	Cancelled      bool
	CancelReason   string
	DelayReason    string
	// Scheduled is the time the board counts down to: departure, or arrival for a terminating service.
	Scheduled time.Time
	// Estimated is the forecast for Scheduled. Nil means the delay is unknown.
	Estimated *time.Time
	// Actual is the recorded departure, if any.
	Actual *time.Time
	// Arrived is true once the train has actually arrived at this station.
	Arrived bool
	// StartsHere is true when this station is one of the train's origins.
	StartsHere bool
	// Length is the coach count, or 0 when unknown.
	Length int
	// TOC is the operator's name, or empty.
	TOC        string
	CallPoints []CallPoint
}

// Delayed reports whether the forecast is later than the schedule, or unknown. It ignores cancellation.
func (s *Service) Delayed() bool {
	if s.Estimated == nil {
		return true
	}
	return s.Estimated.Sub(s.Scheduled) >= time.Minute
}

// ETD is the text of the expected-time column: "Cancelled", "Arrived", "Delayed", or a time as HHmm, which
// equals the scheduled time when the train is on time. Times are in the given zone. This mirrors
// Service.displayedDepartureTime in ProcessServices.ts with onTimeText unset.
func (s *Service) ETD(zone *time.Location) string {
	hhmm := func(t time.Time) string { return t.In(zone).Format("1504") }
	switch {
	case s.Cancelled:
		return "Cancelled"
	case s.Arrived && !s.StartsHere:
		return "Arrived"
	case s.Arrived:
		if !s.Delayed() {
			return hhmm(s.Scheduled)
		}
		switch {
		case s.Actual != nil:
			return hhmm(*s.Actual)
		case s.Estimated != nil:
			return hhmm(*s.Estimated)
		default:
			return hhmm(s.Scheduled)
		}
	case s.Estimated == nil:
		return "Delayed"
	case !s.Delayed():
		return hhmm(s.Scheduled)
	default:
		return hhmm(*s.Estimated)
	}
}

// STD is the scheduled time as HHmm in the given zone.
func (s *Service) STD(zone *time.Location) string {
	return s.Scheduled.In(zone).Format("1504")
}

// Notice is the platform warning that replaces the train list.
type Notice int

const (
	NoNotice Notice = iota
	// StandClear warns of a train passing the platform.
	StandClear
	// NotForPublicUse warns of a train that is not for passengers.
	NotForPublicUse
)

// View is what the board shows at one moment.
type View struct {
	// Connected is false until a snapshot has arrived, and after the connection is lost.
	Connected bool
	Services  []Service
	Notice    Notice
	// Alterations lists movement IDs that have moved between a watched and an unwatched platform since the
	// previous view. The board announces a platform alteration when it is non-empty.
	Alterations []string
}
