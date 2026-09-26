package live

import (
	"encoding/binary"
	"encoding/hex"
	"hash/fnv"
	"maps"
	"slices"
	"strconv"
)

const (
	digestField  = "\x1f"
	digestRecord = "\x1e"
)

// State is the view this connection holds: the movements the service sent, keyed by movement ID, in the order
// the service wants them shown. Treat its maps, slices and entities as immutable:
// successive states can share unchanged data.
type State struct {
	Station      Location
	Epoch        string
	Revision     uint64
	Window       Window
	Movements    map[string]*Movement
	Ordering     []string
	Overrides    map[string]*PlatformOverride
	NRCCMessages []NRCCMessage
}

// Reduce folds a snapshot or update into the state and returns the result. A snapshot replaces the state
// wholesale. An update whose epoch or previous revision doesn't match returns nil: a gap invalidates the view
// until an authoritative snapshot replaces it. The previous state is left untouched, so a caller can compare
// the two.
func Reduce(state *State, message Message) *State {
	return reduceWithOwnership(state, message, false)
}

func reduceWithOwnership(state *State, message Message, owned bool) *State {
	switch m := message.(type) {
	case *Snapshot:
		next := &State{
			Station:      m.Station,
			Epoch:        m.Epoch,
			Revision:     m.Revision,
			Window:       m.Window,
			Movements:    make(map[string]*Movement, len(m.Movements)),
			Ordering:     m.Ordering,
			Overrides:    make(map[string]*PlatformOverride, len(m.Overrides)),
			NRCCMessages: m.NRCCMessages,
		}
		for i := range m.Movements {
			next.Movements[m.Movements[i].ID] = &m.Movements[i]
		}
		for i := range m.Overrides {
			next.Overrides[m.Overrides[i].ID] = &m.Overrides[i]
		}
		return next
	case *Update:
		if state == nil || m.Epoch != state.Epoch || m.PreviousRevision != state.Revision {
			return nil
		}
		next := &State{
			Station:      state.Station,
			Epoch:        state.Epoch,
			Revision:     m.Revision,
			Window:       m.Window,
			Movements:    state.Movements,
			Ordering:     m.Ordering,
			Overrides:    state.Overrides,
			NRCCMessages: m.NRCCMessages,
		}
		// Public reductions copy changed maps, preserving earlier states. Run
		// can consume maps it exclusively owns; entities stay immutable either way.
		if !owned && (len(m.Removals) != 0 || len(m.Upserts) != 0) {
			next.Movements = maps.Clone(state.Movements)
		}
		if !owned && (len(m.OverrideRemovals) != 0 || len(m.OverrideUpserts) != 0) {
			next.Overrides = maps.Clone(state.Overrides)
		}
		for _, id := range m.Removals {
			delete(next.Movements, id)
		}
		for i := range m.Upserts {
			next.Movements[m.Upserts[i].ID] = &m.Upserts[i]
		}
		for _, removal := range m.OverrideRemovals {
			delete(next.Overrides, removal.ID)
		}
		for i := range m.OverrideUpserts {
			next.Overrides[m.OverrideUpserts[i].ID] = &m.OverrideUpserts[i]
		}
		return next
	default:
		return state
	}
}

// Attested reports whether a heartbeat describes this state rather than a diverged one.
func (s *State) Attested(heartbeat *Heartbeat) bool {
	return heartbeat.Epoch == s.Epoch && heartbeat.Revision == s.Revision && heartbeat.Digest == s.Digest()
}

// Digest is the state digest the service's heartbeats carry.
func (s *State) Digest() string {
	return sortedStateDigest(s.Epoch, s.Revision, sortedMapKeys(s.Movements), s.Ordering, sortedMapKeys(s.Overrides))
}

func sortedMapKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

// StateDigest mirrors the server's live.StateDigest. The two implementations must agree exactly, so a golden
// vector pins them together in both test suites.
//
// The digest covers the shape of the view, not the contents of its entities: both ends replace a movement or
// override wholesale on upsert, so contents can't drift without a revision gap the delta chain already catches.
// This catches what the delta chain can't: a local map that has gained or lost entries.
func StateDigest(epoch string, revision uint64, movementIDs, ordering, overrideIDs []string) string {
	movementIDs, overrideIDs = slices.Clone(movementIDs), slices.Clone(overrideIDs)
	slices.Sort(movementIDs)
	slices.Sort(overrideIDs)
	return sortedStateDigest(epoch, revision, movementIDs, ordering, overrideIDs)
}

func sortedStateDigest(epoch string, revision uint64, movementIDs, ordering, overrideIDs []string) string {
	sum := fnv.New64a()
	write := func(tag, value string) {
		sum.Write([]byte(tag))
		sum.Write([]byte(digestField))
		sum.Write([]byte(value))
		sum.Write([]byte(digestRecord))
	}
	write("v", strconv.Itoa(ProtocolVersion))
	write("e", epoch)
	write("r", strconv.FormatUint(revision, 10))
	for _, id := range movementIDs {
		write("m", id)
	}
	for _, id := range ordering {
		write("n", id)
	}
	for _, id := range overrideIDs {
		write("o", id)
	}
	var value [8]byte
	binary.BigEndian.PutUint64(value[:], sum.Sum64())
	return hex.EncodeToString(value[:])
}
