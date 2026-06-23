import { LexRouter, LexServerError } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import type { DB } from './db/index.ts'
import type { AppConfig } from './config.ts'
import type { ApiKeyProvider } from './apikeys/provider.ts'
import { checkHealth } from './health.ts'
import { logger } from './logger.ts'
import { makeRequireSession } from './session/auth.ts'
import { clearCookieHeader } from './session/cookie.ts'
import * as internal from './lexicons/internal.ts'

export type RouterDeps = { db: DB; config: AppConfig; client: NodeOAuthClient; apiKeys: ApiKeyProvider }

export function buildRouter(deps: RouterDeps): LexRouter {
  const { db, config, client, apiKeys } = deps
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

  // Begin OAuth: returns the authorize URL for the browser to follow. A bad or
  // unresolvable handle makes client.authorize() throw; that's a client error,
  // so surface it as a 400 rather than letting it bubble up as a 500.
  router.add(internal.bps.oauth.start.main, async ({ params }) => {
    let url: URL
    try {
      url = await client.authorize(params.handle)
    } catch (err) {
      logger.info({ err, handle: params.handle }, 'oauth start failed to resolve handle')
      throw new LexServerError(400, {
        error: 'InvalidHandle',
        message: 'Could not start login for that handle. Check it and try again.',
      })
    }
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

  // apiKey.create — returns the full secret ONCE.
  router.add(internal.bps.apiKey.create.main, {
    auth: requireSession,
    handler: async ({ credentials, input }) => {
      const { label, expiresAt } = input.body
      const created = await apiKeys.createKey(credentials.did, {
        label,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      return {
        body: {
          id: created.id,
          label: created.label,
          preview: created.preview,
          createdAt: created.createdAt.toISOString(),
          ...(created.expiresAt ? { expiresAt: created.expiresAt.toISOString() } : {}),
          key: created.full,
        },
      }
    },
  })

  // apiKey.list — metadata only.
  router.add(internal.bps.apiKey.list.main, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const keys = await apiKeys.listKeys(credentials.did)
      return {
        body: {
          keys: keys.map((k) => ({
            id: k.id,
            label: k.label,
            preview: k.preview,
            createdAt: k.createdAt.toISOString(),
            ...(k.expiresAt ? { expiresAt: k.expiresAt.toISOString() } : {}),
          })),
        },
      }
    },
  })

  // apiKey.delete — revoke by id (scoped to the caller).
  router.add(internal.bps.apiKey.delete.main, {
    auth: requireSession,
    handler: async ({ credentials, input }) => {
      await apiKeys.deleteKey(credentials.did, input.body.id)
      return { body: { ok: true } }
    },
  })

  return router
}
