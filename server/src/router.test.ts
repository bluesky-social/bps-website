// server/src/router.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDb, type DB } from './db/index.ts'
import { loadConfig } from './config.ts'
import { createOAuthClient } from './oauth/client.ts'
import { createPostgresApiKeyProvider } from './apikeys/postgres-provider.ts'
import { buildRouter } from './router.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

let db: DB

before(async () => {
  db = createDb(url)
})
after(async () => {
  await db.destroy()
})

test('router.fetch serves XRPC methods (whoami rejects without a cookie)', async () => {
  const cfg = loadConfig({
    BPS_PORT: '8080',
    BPS_DATABASE_URL: url,
    BPS_SITE_ORIGIN: 'http://localhost:3000',
    BPS_API_ORIGIN: 'http://127.0.0.1:8080',
    BPS_COOKIE_DOMAIN: 'localhost',
    BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32),
    BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
    NODE_ENV: 'development',
  })
  const client = await createOAuthClient(db, cfg)
  const apiKeys = createPostgresApiKeyProvider(db)
  const router = buildRouter({ db, config: cfg, client, apiKeys })
  // No session cookie → the auth gate rejects. This proves router.fetch routes
  // and runs the auth middleware (liveness is covered by GET /healthz in app.test.ts).
  const res = await router.fetch(
    new Request('http://local/xrpc/internal.bps.account.whoami'),
  )
  assert.equal(res.status, 401)
})
