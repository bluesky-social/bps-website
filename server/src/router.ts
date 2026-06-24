import { LexRouter, LexServerError, LexServerAuthError } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
import { sql } from 'kysely'
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
import { fetchProfile } from './account/profile.ts'

export type RouterDeps = { db: DB; config: AppConfig; client: NodeOAuthClient; apiKeys: ApiKeyProvider }

export function buildRouter(deps: RouterDeps): LexRouter {
  const { db, config, client, apiKeys } = deps
  const requireSession = makeRequireSession(config)

  const router = new LexRouter({
    upgradeWebSocket,
    onHandlerError: ({ error, method }) => {
      // LexServerError/LexServerAuthError are expected client errors (4xx). Log them
      // at warn; reserve error level for genuinely unexpected failures (5xx).
      if (error instanceof LexServerError) {
        logger.warn({ err: error, method: method.nsid }, 'handler client error')
      } else {
        logger.error({ err: error, method: method.nsid }, 'unexpected handler error')
      }
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
        .select(['did', 'handle', 'email'])
        .where('did', '=', credentials.did)
        .executeTakeFirst()
      if (!row) {
        // Valid cookie but the account no longer exists (e.g. deleted) → not logged in.
        throw new LexServerAuthError('AuthenticationRequired', 'Account not found', {
          Bearer: { realm: 'account' },
        })
      }
      return { body: { did: credentials.did, ...(row.handle ? { handle: row.handle } : {}), hasEmail: !!row.email } }
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

  // account.profile — public bsky profile (handle/displayName/avatar) fetched
  // unauthenticated from the public AppView. Independent of the user's PDS/scope.
  router.add(internal.bps.account.profile.main, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const profile = await fetchProfile(config.appViewUrl, credentials.did)
      return { body: profile }
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

  // setEmail — store-only, unverified. Minimal shape check.
  router.add(internal.bps.account.setEmail.main, {
    auth: requireSession,
    handler: async ({ credentials, input }) => {
      const email = input.body.email.trim()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new LexServerError(400, { error: 'InvalidEmail', message: 'Enter a valid email address.' })
      }
      await db
        .updateTable('account')
        .set({ email, updated_at: sql`now()` })
        .where('did', '=', credentials.did)
        .execute()
      return { body: { ok: true } }
    },
  })

  // account.delete — hard delete: revoke OAuth session, delete api_key rows + account row, delete session row, clear cookie.
  // Ordering rationale: deleteConsumer (account + api_key) goes BEFORE the oauth_session cleanup so
  // that any partial failure leaves a safe state — once the account row is gone whoami returns 401,
  // making the user effectively deleted even if the orphaned oauth_session cleanup fails later.
  // A single cross-store transaction is intentionally NOT used: under the Kong-future adapter the
  // consumer (account+keys) and oauth_session live in different stores, making a cross-store
  // transaction impossible without breaking the ApiKeyProvider port abstraction.
  router.add(internal.bps.account.delete.main, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const did = credentials.did
      await client.revoke(did).catch((err) => logger.warn({ err }, 'revoke during delete failed'))
      await apiKeys.deleteConsumer(did) // atomic: deletes api_key rows + the account row together
      await db.deleteFrom('oauth_session').where('did', '=', did).execute() // cleanup; if this fails, account is already gone so whoami still 401s
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'set-cookie': clearCookieHeader(config) },
      })
    },
  })

  return router
}
