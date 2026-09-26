package live

import (
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// Movements and published views are immutable. Keep only the bounded visible
// selection; an unchanged observation can return the same service storage.
type projectedService struct {
	movement *Movement
	legacy   bool
	platform string
	service  *model.Service
}

type projector struct {
	previous, next []projectedService
	valid          bool
	view           model.View
}

// Authoritative snapshots replace movement identities. Drop references to the
// previous graph, keeping only the bounded selection buffers.
func (p *projector) invalidate() {
	clear(p.previous)
	p.previous = p.previous[:0]
	p.valid = false
	p.view = model.View{}
}

func (p *projector) display(state *State, opts Options, now time.Time) (model.View, bool) {
	if opts.MaxServices <= 0 || opts.MaxServices > 64 {
		*p = projector{}
		return Display(state, opts, now), true
	}
	p.next = p.next[:0]
	n, platform := visitServices(state, opts, now, func(movement *Movement, platform string) {
		p.next = append(p.next, projectedService{movement: movement, legacy: opts.LegacyTOCNames, platform: platform})
	})
	changed := !p.valid || n != p.view.Notice || platform != p.view.NoticePlatform || len(p.next) != len(p.previous)
	if !changed {
		for i := range p.next {
			next, previous := &p.next[i], &p.previous[i]
			arrived := next.movement.Arrival.Actual != nil && !next.movement.Arrival.Actual.After(now)
			if next.movement != previous.movement || next.legacy != previous.legacy || next.platform != previous.platform || arrived != previous.service.Arrived {
				changed = true
				break
			}
		}
	}
	if !changed {
		// Scratch identities never become part of the published view.
		clear(p.next)
		p.next = p.next[:0]
		return p.view, false
	}
	// Allocate only a changed view. Earlier views remain independently owned.
	services := make([]model.Service, len(p.next))
	for i := range p.next {
		next := &p.next[i]
		services[i] = p.service(next.movement, next.legacy, now)
		if next.movement.Platform.Suppressed == nil || !*next.movement.Platform.Suppressed {
			services[i].Platform = next.platform
		}
		next.service = &services[i]
	}
	clear(p.previous)
	p.previous, p.next = p.next, p.previous[:0]
	p.valid = true
	p.view = model.View{Connected: true, Services: services, Notice: n, NoticePlatform: platform}
	return p.view, true
}

func (p *projector) service(movement *Movement, legacy bool, now time.Time) model.Service {
	for i := range p.previous {
		previous := &p.previous[i]
		if previous.movement == movement && previous.legacy == legacy {
			s := *previous.service
			s.Arrived = movement.Arrival.Actual != nil && !movement.Arrival.Actual.After(now)
			return s
		}
	}
	return service(movement, legacy, now)
}
