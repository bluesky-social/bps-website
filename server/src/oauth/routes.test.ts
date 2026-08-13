import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import express from 'express'
import {
  JoseKey,
  NodeOAuthClient,
  requestLocalLock,
} from '@atproto/oauth-client-node'
import { createDb, type DB } from '../db/index.ts'
import { loadConfig } from '../config.ts'
import { createOAuthClient } from './client.ts'
import { buildClientMetadata } from './client-metadata.ts'
import { createStateStore } from './state-store.ts'
import { createSessionStore } from './session-store.ts'
import { mountOAuthRoutes } from './routes.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

// NOTE on jwks-in-dev: in dev mode, createOAuthClient uses the atproto loopback form
// (client_id = 'http://localhost', token_endpoint_auth_method = 'none', no keyset).
// This means client.jwks returns { keys: [] }. To exercise the jwks route meaningfully,
// the main test suite uses a prod-style NodeOAuthClient (https origins + ephemeral ES256
// key), which has a populated keyset. A separate describe block verifies the dev loopback
// variant still serves 200 (with empty keys — that's correct per spec).

let db: DB

before(async () => {
  db = createDb(url)
})
after(async () => {
  await db.destroy()
})

// ── Prod-style client (hosted metadata + keyset) ─────────────────────────────────────────────
describe('prod-style client (https apiOrigin + keyset)', () => {
  let server: ReturnType<express.Express['listen']>
  let base: string

  before(async () => {
    const key = await JoseKey.generate(['ES256'], 'test-key-1')
    const prodCfg = loadConfig({
      BPS_PORT: '8080',
      BPS_DATABASE_URL: url,
      BPS_SITE_ORIGIN: 'https://example.com',
      BPS_API_ORIGIN: 'https://api.example.com',
      BPS_COOKIE_DOMAIN: 'example.com',
      BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32),
      BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
      BPS_OAUTH_PRIVATE_KEY: 'placeholder', // satisfies validation; we supply our own keyset below
      NODE_ENV: 'production',
    })
    const client = new NodeOAuthClient({
      clientMetadata: buildClientMetadata(prodCfg),
      keyset: [key],
      stateStore: createStateStore(db),
      sessionStore: createSessionStore(db),
      handleResolver: prodCfg.oauthHandleResolver,
      // In-process lock: enough for a single-process test, and keeps the
      // library's "credentials might get revoked" warning out of the output.
      requestLock: requestLocalLock,
    })
    const app = express()
    mountOAuthRoutes(app, { client, config: prodCfg, db })
    await new Promise<void>((r) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
        r()
      })
    })
  })

  after(async () => {
    await new Promise<void>((r) => server.close(() => r()))
  })

  // The client metadata document is published by the site build at the site
  // origin, because client_id must equal the URL the document is fetched from.
  // Serving a copy here would publish a document that is invalid at its own URL
  // and is a live footgun if anyone configured it as the client_id.
  test('GET /oauth-client-metadata.json is not served by the API', async () => {
    const res = await fetch(`${base}/oauth-client-metadata.json`)
    assert.equal(res.status, 404)
  })

  test('GET /jwks.json returns a JWKS with at least one key', async () => {
    const res = await fetch(`${base}/jwks.json`)
    assert.equal(res.status, 200)
    const json = (await res.json()) as { keys: unknown[] }
    assert.ok(
      Array.isArray(json.keys) && json.keys.length >= 1,
      `expected ≥1 key, got ${json.keys.length}`,
    )
  })

  test('GET /oauth-callback without valid params does not 200', async () => {
    const res = await fetch(`${base}/oauth-callback`, { redirect: 'manual' })
    assert.notEqual(res.status, 200)
  })
})

// ── Dev loopback client (token_endpoint_auth_method = 'none', no keyset) ─────────────────────
// In dev the loopback client_id is the special sentinel 'http://localhost' and there is
// no keyset, so jwks.keys is []. The route must still return 200 — the implementation is
// the same; only the payload content differs.
describe('dev loopback client', () => {
  let server: ReturnType<express.Express['listen']>
  let base: string

  const devCfg = loadConfig({
    BPS_PORT: '8080',
    BPS_DATABASE_URL: url,
    BPS_SITE_ORIGIN: 'http://localhost:3000',
    BPS_API_ORIGIN: 'http://127.0.0.1:8080',
    BPS_COOKIE_DOMAIN: 'localhost',
    BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32),
    BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
    NODE_ENV: 'development',
  })

  before(async () => {
    const client = await createOAuthClient(db, devCfg, requestLocalLock)
    const app = express()
    mountOAuthRoutes(app, { client, config: devCfg, db })
    await new Promise<void>((r) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
        r()
      })
    })
  })

  after(async () => {
    await new Promise<void>((r) => server.close(() => r()))
  })

  test('GET /jwks.json returns 200 with a keys array (empty in dev loopback)', async () => {
    const res = await fetch(`${base}/jwks.json`)
    assert.equal(res.status, 200)
    const json = (await res.json()) as { keys: unknown[] }
    assert.ok(
      Array.isArray(json.keys),
      'response body must have a "keys" array',
    )
    // In the dev loopback form, keys is [] because there is no keyset (by atproto spec).
    assert.equal(json.keys.length, 0)
  })
})
