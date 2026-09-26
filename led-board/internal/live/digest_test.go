package live

import (
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"slices"
	"strconv"
	"testing"
)

func referenceDigest(epoch string, revision uint64, movements, ordering, overrides []string) string {
	sum := fnv.New64a()
	write := func(tag, value string) { sum.Write([]byte(tag + "\x1f" + value + "\x1e")) }
	write("v", strconv.Itoa(ProtocolVersion))
	write("e", epoch)
	write("r", strconv.FormatUint(revision, 10))
	for _, id := range slices.Sorted(slices.Values(movements)) {
		write("m", id)
	}
	for _, id := range ordering {
		write("n", id)
	}
	for _, id := range slices.Sorted(slices.Values(overrides)) {
		write("o", id)
	}
	return fmt.Sprintf("%016x", sum.Sum64())
}

func TestDigestPreservesWireBytesAndInputOrder(t *testing.T) {
	rng := rand.New(rand.NewPCG(92, 16))
	for range 1000 {
		ids := make([]string, rng.IntN(100))
		for i := range ids {
			ids[i] = fmt.Sprintf("%d/é🚉\x1f\x1e", rng.IntN(10000))
		}
		ordering, original := slices.Clone(ids), slices.Clone(ids)
		overrides := []string{"β", "A", "", "a"}
		epoch, revision := "époque\x1e", rng.Uint64()
		want := referenceDigest(epoch, revision, ids, ordering, overrides)
		if got := StateDigest(epoch, revision, ids, ordering, overrides); got != want {
			t.Fatalf("digest %q, want %q", got, want)
		}
		if !slices.Equal(ids, original) || !slices.Equal(ordering, original) || !slices.Equal(overrides, []string{"β", "A", "", "a"}) {
			t.Fatal("digest mutated input slices")
		}
		state := &State{Epoch: epoch, Revision: revision, Ordering: ordering, Movements: map[string]*Movement{}, Overrides: map[string]*PlatformOverride{}}
		for _, id := range ids {
			state.Movements[id] = nil
		}
		for _, id := range overrides {
			state.Overrides[id] = nil
		}
		// Map keys deduplicate repeated IDs; ordering deliberately retains duplicates.
		slices.Sort(original)
		want = referenceDigest(epoch, revision, slices.Compact(original), ordering, overrides)
		if got := state.Digest(); got != want {
			t.Fatalf("state digest %q, want %q", got, want)
		}
	}
}
