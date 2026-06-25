import { randomBytes, createHash } from 'node:crypto'

export const KEY_PREFIX = 'jsk_'

// SAFETY: A fast unsalted SHA-256 (rather than a slow password hash like
// bcrypt/scrypt/argon2) is acceptable here ONLY because the input is a
// high-entropy random token, not a user-chosen secret. `generateApiKey` draws
// 32 bytes (256 bits) from a CSPRNG, so the keyspace is far too large to brute
// force or build a useful rainbow table against — the usual reasons to salt and
// slow-hash a password do not apply. If the key length or randomness source in
// `generateApiKey` ever changes, revisit this: shrinking the entropy would make
// a fast hash unsafe.
export function hashApiKey(full: string): string {
  return createHash('sha256').update(full).digest('hex')
}

export function generateApiKey(): { full: string; hash: string; preview: string } {
  const body = randomBytes(32).toString('base64url')
  const full = `${KEY_PREFIX}${body}`
  const hash = hashApiKey(full)
  const preview = `${KEY_PREFIX}…${body.slice(-4)}`
  return { full, hash, preview }
}
