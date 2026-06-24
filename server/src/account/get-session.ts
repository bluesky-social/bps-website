import type { OAuthSession } from '@atproto/oauth-client-node'
import { logger } from '../logger.ts'

// Reads the user's atproto account session (handle + email) from their PDS via
// the restored OAuth session. PDS-direct — no AppView proxy. Never throws: a
// failure just yields {} so login is unaffected.
export async function safeGetSession(
  oauthSession: Pick<OAuthSession, 'fetchHandler'>,
): Promise<{ handle?: string; email?: string }> {
  try {
    const res = await oauthSession.fetchHandler('/xrpc/com.atproto.server.getSession')
    if (!res.ok) return {}
    const data = (await res.json()) as { handle?: string; email?: string }
    const out: { handle?: string; email?: string } = {}
    if (data.handle) out.handle = data.handle
    if (data.email) out.email = data.email
    return out
  } catch (err) {
    logger.warn({ err }, 'getSession during login failed')
    return {}
  }
}
