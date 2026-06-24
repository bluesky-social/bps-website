import type { OAuthSession } from '@atproto/oauth-client-node'
import { logger } from '../logger.ts'

// Reads the user's atproto account session (handle + email) from their PDS via
// the restored OAuth session. PDS-direct — no AppView proxy. Never throws: a
// failure just yields { ok: false } so login is unaffected.
//
// `ok` is the authoritative "did we observe the PDS session" signal: true only
// when the getSession call succeeded and its body parsed (handle/email are then
// set when present); false on any non-ok response or thrown error. Callers that
// distinguish "observed, but PDS shared no email" from "the call failed" must
// key off `ok`, never off the mere presence of `handle`.
export async function safeGetSession(
  oauthSession: Pick<OAuthSession, 'fetchHandler'>,
): Promise<{ ok: boolean; handle?: string; email?: string }> {
  try {
    const res = await oauthSession.fetchHandler('/xrpc/com.atproto.server.getSession')
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as { handle?: string; email?: string }
    const out: { ok: boolean; handle?: string; email?: string } = { ok: true }
    if (data.handle) out.handle = data.handle
    if (data.email) out.email = data.email
    return out
  } catch (err) {
    logger.warn({ err }, 'getSession during login failed')
    return { ok: false }
  }
}
