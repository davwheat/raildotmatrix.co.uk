import type { CISState } from './types'

const FIELD = String.fromCharCode(0x1f)
const RECORD = String.fromCharCode(0x1e)
const OFFSET_BASIS = 14695981039346656037n
const PRIME = 1099511628211n
const MASK = 0xffffffffffffffffn

/**
 * Mirrors the server's live.StateDigest. The two implementations must agree
 * exactly, so a golden vector pins them together in both test suites.
 *
 * The digest covers the shape of the view, not the contents of its entities:
 * both ends replace a movement or override wholesale on upsert, so contents
 * cannot drift without a revision gap the delta chain already catches, and
 * hashing them would need a canonical JSON encoding that Go and browsers do not
 * agree on. This catches what the delta chain cannot: a local map that has
 * gained or lost entries.
 */
export function stateDigest(epoch: string, revision: number, movementIds: string[], ordering: string[], overrideIds: string[]): string {
  const records: string[] = []
  const write = (tag: string, value: string) => records.push(`${tag}${FIELD}${value}${RECORD}`)
  write('v', '1')
  write('e', epoch)
  write('r', String(revision))
  // Identifiers are ASCII, so sorting UTF-16 code units matches the server's byte sort.
  for (const id of [...movementIds].sort()) write('m', id)
  for (const id of ordering) write('n', id)
  for (const id of [...overrideIds].sort()) write('o', id)

  let hash = OFFSET_BASIS
  for (const byte of new TextEncoder().encode(records.join(''))) {
    hash = ((hash ^ BigInt(byte)) * PRIME) & MASK
  }
  return hash.toString(16).padStart(16, '0')
}

export function digestState(state: CISState): string {
  return stateDigest(state.epoch, state.revision, [...state.movements.keys()], state.ordering, [...state.overrides.keys()])
}
