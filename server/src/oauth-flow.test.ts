import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { sealData } from 'iron-session'
import { createDb, type DB } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { loadConfig } from './config.ts'
import { createOAuthClient } from './oauth/client.ts'
import { buildApp } from './app.ts'
import { SESSION_COOKIE_NAME } from './session/cookie.ts'

const url = process.env.BPS_TEST_DATABASE_URL ?? 'postgres://bps:bps@localhost:5433/bps_account'
const cfg = loadConfig({
  BPS_PORT: '8080', BPS_DATABASE_URL: url, BPS_SITE_ORIGIN: 'http://localhost:3000',
  BPS_API_ORIGIN: 'http://127.0.0.1:8080', BPS_COOKIE_DOMAIN: 'localhost',
  BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32), BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
  NODE_ENV: 'development',
})
const did = 'did:plc:flowtest' as any
let db: DB, server: any, base: string

before(async () => {
  db = createDb(url)
  await runMigrations(db)
  await db.deleteFrom('account').where('did', '=', did).execute()
  await db.insertInto('account').values({ did, email: null }).execute()
  const client = await createOAuthClient(db, cfg)
  const app = buildApp({ db, config: cfg, client })
  await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; r() }) })
})
after(async () => {
  await db.deleteFrom('account').where('did', '=', did).execute()
  await new Promise<void>((r) => server.close(() => r()))
  await db.destroy()
})

async function cookie(): Promise<string> {
  const sealed = await sealData({ did }, { password: cfg.ironSessionPassword })
  return `${SESSION_COOKIE_NAME}=${sealed}`
}

test('whoami returns 401-ish without a cookie', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.account.whoami`)
  assert.notEqual(res.status, 200)
})

test('whoami returns the did + hasEmail with a valid cookie', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.account.whoami`, { headers: { cookie: await cookie() } })
  assert.equal(res.status, 200)
  const json = (await res.json()) as { did: string; hasEmail: boolean }
  assert.equal(json.did, did)
  assert.equal(json.hasEmail, false)
})

test('logout returns ok and an expiring Set-Cookie', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.oauth.logout`, { method: 'POST', headers: { cookie: await cookie() } })
  assert.equal(res.status, 200)
  const setCookie = res.headers.get('set-cookie') ?? ''
  assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=`))
  assert.match(setCookie, /Max-Age=0|Expires=/i)
})
