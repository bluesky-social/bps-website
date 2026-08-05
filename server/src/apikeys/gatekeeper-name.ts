import { randomBytes } from 'node:crypto'

// TODO(stopgap): the user-facing label is encoded into Gatekeeper's immutable
// key `name` as "{label} {nonce}" because keys have no mutable metadata home.
// Consequences: labels are immutable and length-limited. Revisit when
// Gatekeeper keys grow mutable metadata.
//
// The nonce exists ONLY to satisfy Gatekeeper's unconditional
// UNIQUE (service_name, name) constraint, which counts revoked keys forever —
// without it, deleting a key would burn its label permanently.
// TODO(upstream): ask Gatekeeper to exclude revoked keys from name uniqueness
// (partial unique index); the nonce can then shrink or disappear.

export const NAME_MAX_LENGTH = 128
export const NONCE_LENGTH = 8

export function encodeKeyName(label: string): string {
  const trimmed = label.trim()
  if (trimmed === '') {
    throw new Error('api key label must not be blank')
  }
  // 6 random bytes → 8 base64url chars; entropy only, never parsed or looked up.
  const nonce = randomBytes(6).toString('base64url')
  const maxLabel = NAME_MAX_LENGTH - 1 - NONCE_LENGTH
  return `${trimmed.slice(0, maxLabel).trimEnd()} ${nonce}`.slice(0, NAME_MAX_LENGTH)
}

export function parseKeyLabel(name: string): string {
  const i = name.lastIndexOf(' ')
  return i === -1 ? name : name.slice(0, i)
}
