package live

// Single-owner path for Run's goroutine. Entities stay immutable,
// but the previous State's maps may be consumed. Neither State nor its maps may
// escape this owner; public Reduce retains its ordinary immutable semantics.
func reduceOwned(state *State, message Message, platforms []string) (*State, []string) {
	previous := state
	// Cloning the full map is faster than collecting old identities for a
	// large watched-platform delta. Bound this path to small deltas; whole-
	// station boards need no alteration history and can consume any delta.
	if update, ok := message.(*Update); ok && len(platforms) != 0 && len(update.Upserts) > 8 {
		next := Reduce(state, message)
		return next, deltaPlatformAlterations(previous, next, platforms, message)
	}
	if update, ok := message.(*Update); ok && state != nil && update.Epoch == state.Epoch && update.PreviousRevision == state.Revision && len(platforms) != 0 && len(update.Upserts) != 0 {
		// Alteration comparison only needs the old entities mentioned in upserts.
		// Keep the original helper's final-upsert and removal semantics.
		old := *state
		old.Movements = make(map[string]*Movement, len(update.Upserts))
		for i := range update.Upserts {
			id := update.Upserts[i].ID
			if movement, seen := state.Movements[id]; seen {
				old.Movements[id] = movement
			}
		}
		previous = &old
	}
	next := reduceWithOwnership(state, message, true)
	return next, deltaPlatformAlterations(previous, next, platforms, message)
}
