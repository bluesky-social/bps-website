import { LexRouter } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import type { DB } from './db/index.ts'
import type { AppConfig } from './config.ts'
import { checkHealth } from './health.ts'
import { logger } from './logger.ts'
import { makeRequireSession } from './session/auth.ts'
import { clearCookieHeader } from './session/cookie.ts'
import * as internal from './lexicons/internal.ts'

export type RouterDeps = { db: DB; config: AppConfig; client: NodeOAuthClient }

export function buildRouter(deps: RouterDeps): LexRouter {
  const { db, config, client } = deps
  const requireSession = makeRequireSession(config)

  const router = new LexRouter({
    upgradeWebSocket,
    onHandlerError: ({ error, method }) => {
      logger.error({ err: error, method: method.nsid }, 'handler error')
    },
  })

  router.add(internal.bps.health.main, async () => {
    return { body: await checkHealth(db) }
  })

  // Begin OAuth: returns the authorize URL for the browser to follow.
  router.add(internal.bps.oauth.start.main, async ({ params }) => {
    const url = await client.authorize(params.handle)
    return { body: { authorizeUrl: url.toString() } }
  })

  // whoami: authenticated via the session cookie.
  router.add(internal.bps.account.whoami.main, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const row = await db
        .selectFrom('account')
        .select(['did', 'email'])
        .where('did', '=', credentials.did)
        .executeTakeFirst()
      return { body: { did: credentials.did, hasEmail: !!row?.email } }
    },
  })

  // logout: revoke the atproto session + clear the cookie. Cookie clearing needs
  // Express res, which lex-server handlers don't have — so logout returns a
  // Set-Cookie via a raw Response.
  router.add(internal.bps.oauth.logout.main, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      await client.revoke(credentials.did).catch((err) => logger.warn({ err }, 'revoke failed'))
      await db.deleteFrom('oauth_session').where('did', '=', credentials.did as DidString).execute()
      // Clear the cookie by returning an expired Set-Cookie on a raw Response.
      const expired = clearCookieHeader(config)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'set-cookie': expired },
      })
    },
  })

  return router
}
