import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { DidString } from '@atproto/syntax'
import { sealData } from 'iron-session'
import { createDb, type DB } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { loadConfig } from './config.ts'
import { createOAuthClient } from './oauth/client.ts'
import { createPostgresApiKeyProvider } from './apikeys/postgres-provider.ts'
import { buildApp } from './app.ts'
import { SESSION_COOKIE_NAME } from './session/cookie.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'
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
const did = 'did:plc:accountops' as DidString
let db: DB, server: any, base: string

before(async () => {
  db = createDb(url)
  await runMigrations(db)
  const client = await createOAuthClient(db, cfg)
  const apiKeys = createPostgresApiKeyProvider(db)
  const app = buildApp({ db, config: cfg, client, apiKeys })
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      r()
    })
  })
})
after(async () => {
  await db.deleteFrom('account').where('did', '=', did).execute()
  await new Promise<void>((r) => server.close(() => r()))
  await db.destroy()
})
beforeEach(async () => {
  await db.deleteFrom('account').where('did', '=', did).execute()
  await db.insertInto('account').values({ did, email: null }).execute()
})

async function cookie(): Promise<string> {
  return `${SESSION_COOKIE_NAME}=${await sealData({ did }, { password: cfg.ironSessionPassword })}`
}

test('delete removes the account + its keys and whoami then 401s', async () => {
  const c = await cookie()
  // seed a key so cascade is exercised
  await fetch(`${base}/xrpc/internal.bps.apiKey.create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: c },
    body: JSON.stringify({ label: 'doomed' }),
  })
  const del = await fetch(`${base}/xrpc/internal.bps.account.delete`, {
    method: 'POST',
    headers: { cookie: c },
  })
  assert.equal(del.status, 200)
  assert.match(del.headers.get('set-cookie') ?? '', /Max-Age=0/)

  const acct = await db
    .selectFrom('account')
    .selectAll()
    .where('did', '=', did)
    .execute()
  assert.equal(acct.length, 0)
  const keys = await db
    .selectFrom('api_key')
    .selectAll()
    .where('did', '=', did)
    .execute()
  assert.equal(keys.length, 0)

  // cookie still valid but account gone → whoami treats as unauthenticated
  const who = await fetch(`${base}/xrpc/internal.bps.account.whoami`, {
    headers: { cookie: c },
  })
  assert.notEqual(who.status, 200)
})
