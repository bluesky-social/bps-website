import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createDb, type DB } from './db/index.ts'
import { loadConfig } from './config.ts'
import { requestLocalLock } from '@atproto/oauth-client-node'
import { createOAuthClient } from './oauth/client.ts'
import { createPostgresApiKeyProvider } from './apikeys/postgres-provider.ts'
import { buildApp } from './app.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

let db: DB
let server: Server
let base: string

before(async () => {
  db = createDb(url)
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
  const client = await createOAuthClient(db, cfg, requestLocalLock)
  const apiKeys = createPostgresApiKeyProvider(db)
  const app = buildApp({ db, config: cfg, client, apiKeys })
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo
      base = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await db.destroy()
})

test('GET /_health returns 200 ok', async () => {
  const res = await fetch(`${base}/_health`)
  assert.equal(res.status, 200)
  const json = (await res.json()) as { status: string }
  assert.equal(json.status, 'ok')
})
