// Package fixtures holds hand-written views that mirror the states of raildotmatrix.co.uk's visual tests
// (tests/visual/fixtures.ts), for the preview tool and the board tests.
package fixtures

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Clock is the instant the web baselines were captured at; fixture times are offsets from it.
var Clock = time.Date(2026, 9, 13, 18, 40, 0, 0, time.UTC)

// Names lists the fixtures in the order the web tests run them.
var Names = []string{
	"connecting", "no-departures", "terminating", "single-departure", "busy-board", "delayed", "unknown-delay",
	"cancelled", "dividing-service", "stand-clear", "non-public-train", "platform-alteration", "first-departs",
	"triple-line", "dividing-second", "last-departs",
}

// Steps returns the views a fixture goes through. Most have one; a platform alteration needs a change to
// announce and a departure needs a first train to leave, so those have two.
func Steps(name string) []model.View {
	switch name {
	case "connecting":
		return []model.View{{}}
	case "no-departures":
		return []model.View{{Connected: true}}
	case "terminating":
		return snapshot(terminating(), bedford())
	case "single-departure":
		return snapshot(victoria())
	case "detailed-formation":
		s := victoria()
		s.Length = 8
		s.Coaches = []model.Coach{
			{Label: "A", Loading: 15, FirstClass: true, Accessible: true},
			{Label: "B", Loading: 45, FirstClass: true, Accessible: true, Cycles: true},
			{Label: "C", Loading: 100, Cycles: true},
			{Label: "D", Loading: 0},
			{Label: "E", Loading: -1, Accessible: true},
			{Label: "F", Loading: 70},
			{Label: "G", Loading: 30},
			{Label: "H", Loading: 90},
		}
		return snapshot(s, bedford())
	case "busy-board":
		return snapshot(victoria(), bedford(), gatwick(), londonBridge(), brighton())
	case "delayed":
		s := victoria()
		s.ID = "delayed"
		s.Estimated = at(900)
		s.DelayReason = "This is due to a speed restriction over defective track"
		return snapshot(s, bedford())
	case "unknown-delay":
		s := victoria()
		s.ID = "unknown"
		s.Estimated = nil
		return snapshot(s, bedford())
	case "cancelled":
		s := victoria()
		s.ID = "cancelled"
		s.Cancelled = true
		s.CancelReason = "This is due to a fault on this train"
		return snapshot(s, bedford())
	case "dividing-service":
		return snapshot(dividing(), bedford())
	case "stand-clear":
		v := snapshot(victoria(), bedford())
		v[0].Notice, v[0].NoticePlatform = model.StandClear, "2"
		return v
	case "non-public-train":
		v := snapshot(victoria(), bedford())
		v[0].Notice, v[0].NoticePlatform = model.NotForPublicUse, "10A"
		return v
	case "platform-alteration":
		before := snapshot(victoria(), bedford())
		after := snapshot(bedford())
		after[0].Alterations = []string{"victoria"}
		return append(before, after...)
	case "triple-line":
		s := dividing()
		s.ID = "triple"
		s.Destinations = []model.Location{horshamLoc, littlehamptonLoc, {Name: "Bognor Regis", CRS: "BOG"}}
		return snapshot(s, bedford(), gatwick())
	case "dividing-second":
		return snapshot(victoria(), dividing(), bedford())
	case "first-departs":
		return append(snapshot(victoria(), bedford(), gatwick()), snapshot(bedford(), gatwick())...)
	case "last-departs":
		return append(snapshot(victoria()), model.View{Connected: true})
	}
	return nil
}

func at(offsetSeconds int) *time.Time {
	t := Clock.Add(time.Duration(offsetSeconds) * time.Second)
	return &t
}

func snapshot(services ...model.Service) []model.View {
	return []model.View{{Connected: true, Services: services}}
}

var (
	victoriaLoc      = model.Location{Name: "London Victoria", CRS: "VIC"}
	londonBridgeLoc  = model.Location{Name: "London Bridge", CRS: "LBG"}
	claphamLoc       = model.Location{Name: "Clapham Junction", CRS: "CLJ"}
	norwoodLoc       = model.Location{Name: "Norwood Junction", CRS: "NWD"}
	gatwickLoc       = model.Location{Name: "Gatwick Airport", CRS: "GTW"}
	brightonLoc      = model.Location{Name: "Brighton", CRS: "BTN"}
	bedfordLoc       = model.Location{Name: "Bedford", CRS: "BDM"}
	stPancrasLoc     = model.Location{Name: "St Pancras International", CRS: "STP"}
	horshamLoc       = model.Location{Name: "Horsham", CRS: "HRH"}
	littlehamptonLoc = model.Location{Name: "Littlehampton", CRS: "LIT"}
)

func service(id, toc, platform string, departure int, length int, dest model.Location, calls ...model.CallPoint) model.Service {
	return model.Service{
		ID:           id,
		Platform:     platform,
		Destinations: []model.Location{dest},
		Origins:      []model.Location{brightonLoc},
		Scheduled:    *at(departure),
		Estimated:    at(departure),
		Length:       length,
		TOC:          toc,
		CallPoints:   calls,
	}
}

func call(l model.Location, arrivalSeconds int, length int) model.CallPoint {
	return model.CallPoint{Name: l.Name, Length: length, Arrival: at(arrivalSeconds)}
}

func victoria() model.Service {
	return service("victoria", "Southern", "4", 180, 8, victoriaLoc, call(claphamLoc, 480, 8), call(victoriaLoc, 840, 8))
}

func bedford() model.Service {
	return service("bedford", "Thameslink", "10A", 420, 12, bedfordLoc, call(londonBridgeLoc, 900, 8), call(stPancrasLoc, 1440, 8), call(bedfordLoc, 3600, 8))
}

func gatwick() model.Service {
	return service("gatwick", "Gatwick Express", "2", 660, 8, gatwickLoc, call(gatwickLoc, 1020, 8))
}

func londonBridge() model.Service {
	dest := londonBridgeLoc
	dest.Via = "via Sydenham"
	return service("london-bridge", "Southern", "5", 900, 8, dest, call(norwoodLoc, 1140, 8), call(londonBridgeLoc, 1500, 8))
}

func brighton() model.Service {
	return service("brighton", "Southern", "1", 1200, 8, brightonLoc, call(gatwickLoc, 1560, 8), call(brightonLoc, 2400, 8))
}

func terminating() model.Service {
	s := service("terminating", "Southern", "3", 240, 8, model.Location{Name: "Terminates here", CRS: "ECR"})
	s.TerminatesHere = true
	return s
}

func dividing() model.Service {
	divide := call(horshamLoc, 1500, 4)
	divide.Divides = []model.Portion{{Length: 4, CallPoints: []model.CallPoint{call(horshamLoc, 1500, 4), call(littlehamptonLoc, 2400, 4)}}}
	s := service("dividing", "Southern", "6", 300, 8, horshamLoc, call(gatwickLoc, 960, 8), divide)
	s.Destinations = append(s.Destinations, littlehamptonLoc)
	return s
}
