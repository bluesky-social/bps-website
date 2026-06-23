import { randomBytes, createHash } from 'node:crypto'

export const KEY_PREFIX = 'jsk_'

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
