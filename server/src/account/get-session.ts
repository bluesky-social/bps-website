import { xrpc } from '@atproto/lex'
import type { OAuthSession } from '@atproto/oauth-client-node'
import * as com from '../lexicons/com.ts'
import { logger } from '../logger.ts'

// Reads the user's atproto account session (handle + email) from their PDS via
// the restored OAuth session. PDS-direct — no AppView proxy. Never throws: a
// failure just yields { ok: false } so login is unaffected.
//
// The call goes through the lex client (`xrpc(com.atproto.server.getSession)`),
// not a hand-rolled fetch: the OAuth session's `fetchHandler` matches lex's
// FetchHandler shape exactly (it adds the PDS origin + DPoP/auth headers), and
// lex drains + validates the response body against the schema for us.
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
    // The session's fetchHandler IS a lex Agent's fetchHandler (path → Response,
    // origin/auth added internally), so it can be passed as the agent directly.
    const { body } = await xrpc(
      { fetchHandler: oauthSession.fetchHandler.bind(oauthSession) },
      com.atproto.server.getSession.main,
    )
    const out: { ok: boolean; handle?: string; email?: string } = { ok: true }
    if (body.handle) out.handle = body.handle
    if (body.email) out.email = body.email
    return out
  } catch (err) {
    logger.warn({ err }, 'getSession during login failed')
    return { ok: false }
  }
}
