import {
  LexRouter,
  LexServerError,
  LexServerAuthError,
} from '@atproto/lex-server'
import { XrpcError, type l } from '@atproto/lex'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import type { DB } from './db/index.ts'
import type { AppConfig } from './config.ts'
import { LabelInUseError } from './apikeys/provider.ts'
import type { ApiKeyProvider } from './apikeys/provider.ts'
import { logger } from './logger.ts'
import { makeRequireSession } from './session/auth.ts'
import { clearCookieHeader } from './session/cookie.ts'
import * as internal from './lexicons/internal.ts'
import { fetchProfile } from './account/profile.ts'
import { refreshEmailIfStale } from './account/refresh-email.ts'
import { createSpacesInviteClient } from './spaces/invite-client.ts'

export type RouterDeps = {
  db: DB
  config: AppConfig
  client: NodeOAuthClient
  apiKeys: ApiKeyProvider
}

export function buildRouter(deps: RouterDeps): LexRouter {
  const { db, config, client, apiKeys } = deps
  const requireSession = makeRequireSession(config)
  const spacesInvites = config.spacesPds
    ? createSpacesInviteClient(config.spacesPds)
    : null

  const spacesRequest = async <T>(request: () => Promise<T>): Promise<T> => {
    if (!spacesInvites) {
      throw new LexServerError(503, {
        error: 'SpacesAlphaUnavailable',
        message: 'Atproto spaces alpha invites are not configured.',
      })
    }
    try {
      return await request()
    } catch (err) {
      if (err instanceof XrpcError) {
        const downstream = err.toDownstreamError()
        throw new LexServerError(downstream.status, downstream.body)
      }
      throw err
    }
  }

  const router = new LexRouter({
    upgradeWebSocket,
    onHandlerError: ({ error, method }) => {
      // LexServerError/LexServerAuthError are expected client errors (4xx). Log them
      // at warn; reserve error level for genuinely unexpected failures (5xx).
      if (error instanceof LexServerError) {
        logger.warn({ err: error, method: method.nsid }, 'handler client error')
      } else {
        logger.error(
          { err: error, method: method.nsid },
          'unexpected handler error',
        )
      }
    },
  })

  // Begin OAuth: returns the authorize URL for the browser to follow. A bad or
  // unresolvable handle makes client.authorize() throw; that's a client error,
  // so surface it as a 400 rather than letting it bubble up as a 500.
  router.add(internal.bps.oauth.start, async ({ params }) => {
    let url: URL
    try {
      url = await client.authorize(params.handle)
    } catch (err) {
      logger.info(
        { err, handle: params.handle },
        'oauth start failed to resolve handle',
      )
      throw new LexServerError(400, {
        error: 'InvalidHandle',
        message:
          'Could not start login for that handle. Check it and try again.',
      })
    }
    // URL.toString() is typed as plain string, but a WHATWG URL always
    // serializes as scheme ':' rest — the shape the uri format brands.
    return { body: { authorizeUrl: url.toString() as l.UriString } }
  })

  // whoami: authenticated via the session cookie.
  router.add(internal.bps.account.whoami, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const row = await db
        .selectFrom('account')
        .select(['did', 'handle', 'email', 'updated_at'])
        .where('did', '=', credentials.did)
        .executeTakeFirst()
      if (!row) {
        // Valid cookie but the account no longer exists (e.g. deleted) → not logged in.
        throw new LexServerAuthError(
          'AuthenticationRequired',
          'Account not found',
          {
            Bearer: { realm: 'account' },
          },
        )
      }
      // account.email mirrors the PDS email. If the row is older than the TTL, opportunistically
      // re-observe + update it. Best-effort and off the critical path: never throws, whoami
      // always serves a value (the refreshed one if it changed, else the stored one).
      const email = await refreshEmailIfStale(db, credentials.did, row, () =>
        client.restore(credentials.did),
      )
      return {
        body: {
          did: credentials.did,
          // The lexicon types `handle` with the `handle` format (branded
          // `${string}.${string}`); the DB column is unconstrained text holding
          // the PDS-reported handle, so cast at the boundary.
          ...(row.handle
            ? { handle: row.handle as `${string}.${string}` }
            : {}),
          ...(email ? { email } : {}),
        },
      }
    },
  })

  // logout: revoke the atproto session + clear the cookie. Returns a structured
  // output (not a raw Response) so the `body` is type-checked against the
  // method's Output<>; the expiring cookie rides along in `headers`.
  router.add(internal.bps.oauth.logout, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      await client
        .revoke(credentials.did)
        .catch((err) => logger.warn({ err }, 'revoke failed'))
      await db
        .deleteFrom('oauth_session')
        .where('did', '=', credentials.did as DidString)
        .execute()
      return {
        headers: { 'set-cookie': clearCookieHeader(config) },
        body: { ok: true },
      }
    },
  })

  // account.profile — public bsky profile (handle/displayName/avatar) fetched
  // unauthenticated from the public AppView. Independent of the user's PDS/scope.
  router.add(internal.bps.account.profile, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const profile = await fetchProfile(config.appViewUrl, credentials.did)
      return { body: profile }
    },
  })

  // Spaces alpha invite codes are issued by the configured destination PDS
  // (or its Entryway invite authority), not by the user's current PDS. The
  // admin credential stays server-side. Listing uses the admin endpoint too;
  // it has no subject parameter, so the client paginates and filters before
  // any code crosses this API boundary.
  router.add(internal.bps.spacesInvite.create, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const created = await spacesRequest(() =>
        spacesInvites!.createInvite(credentials.did),
      )
      const accountUrl = new URL('/account', config.spacesPds!.url).toString()
      return { body: { ...created, accountUrl: accountUrl as l.UriString } }
    },
  })

  router.add(internal.bps.spacesInvite.list, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const codes = await spacesRequest(() =>
        spacesInvites!.listInvites(credentials.did),
      )
      return { body: { codes } }
    },
  })

  // apiKey.create — returns the full secret ONCE.
  router.add(internal.bps.apiKey.create, {
    auth: requireSession,
    handler: async ({ credentials, input }) => {
      const { expiresAt } = input.body
      const label = input.body.label.trim()
      if (label === '') {
        throw new LexServerError(400, {
          error: 'InvalidLabel',
          message: 'Label must not be blank.',
        })
      }
      let created
      try {
        created = await apiKeys.createKey(credentials.did, {
          label,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        })
      } catch (err) {
        if (err instanceof LabelInUseError) {
          throw new LexServerError(400, {
            error: 'LabelInUse',
            message:
              'You already have a key with this name (deleted keys keep their names). Please choose a different name.',
          })
        }
        throw err
      }
      return {
        body: {
          id: created.id,
          label: created.label,
          preview: created.preview,
          createdAt: created.createdAt.toISOString(),
          ...(created.expiresAt
            ? { expiresAt: created.expiresAt.toISOString() }
            : {}),
          status: created.status,
          key: created.full,
        },
      }
    },
  })

  // apiKey.list — metadata only.
  router.add(internal.bps.apiKey.list, {
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
            status: k.status,
          })),
        },
      }
    },
  })

  // apiKey.delete — revoke by id (scoped to the caller).
  router.add(internal.bps.apiKey.delete, {
    auth: requireSession,
    handler: async ({ credentials, input }) => {
      await apiKeys.deleteKey(credentials.did, input.body.id)
      return { body: { ok: true } }
    },
  })

  // account.delete — hard delete: revoke OAuth session, delete api_key rows + account row, delete session row, clear cookie.
  // Ordering rationale: deleteConsumer (account + api_key) goes BEFORE the oauth_session cleanup so
  // that any partial failure leaves a safe state — once the account row is gone whoami returns 401,
  // making the user effectively deleted even if the orphaned oauth_session cleanup fails later.
  // A single cross-store transaction is intentionally NOT used: under the Gatekeeper provider, the
  // consumer (account+keys) and oauth_session live in different stores, making a cross-store
  // transaction impossible without breaking the ApiKeyProvider port abstraction. Under the Gatekeeper
  // provider, deleteConsumer is itself NOT atomic across stores: it revokes keys in Gatekeeper first,
  // loudly failing on partial error, and only deletes the local account row once that succeeds. Under
  // the Postgres provider, deleteConsumer remains a single local transaction.
  router.add(internal.bps.account.delete, {
    auth: requireSession,
    handler: async ({ credentials }) => {
      const did = credentials.did
      await client
        .revoke(did)
        .catch((err) => logger.warn({ err }, 'revoke during delete failed'))
      await apiKeys.deleteConsumer(did) // see provider-specific atomicity note above
      await db.deleteFrom('oauth_session').where('did', '=', did).execute() // cleanup; if this fails, account is already gone so whoami still 401s
      // Structured output (not a raw Response): `body` is type-checked against
      // the method's Output<>; the expiring login cookie rides in `headers`.
      return {
        headers: { 'set-cookie': clearCookieHeader(config) },
        body: { ok: true },
      }
    },
  })

  return router
}
