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
import { LabelInUseError } from './apikeys/provider.ts'
import type { ApiKeyProvider } from './apikeys/provider.ts'
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
const did = 'did:plc:apikeystest' as DidString
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

test('apiKey.create requires auth', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.apiKey.create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'x' }),
  })
  assert.notEqual(res.status, 200)
})

test('create → list → delete round-trip', async () => {
  const c = await cookie()
  const created = await fetch(`${base}/xrpc/internal.bps.apiKey.create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: c },
    body: JSON.stringify({ label: 'ci-key' }),
  })
  assert.equal(created.status, 200)
  const cj = (await created.json()) as {
    id: string
    key: string
    preview: string
  }
  assert.ok(cj.key.startsWith('jsk_'), 'full secret returned once')
  assert.ok(cj.preview.includes('…'))

  const listed = await fetch(`${base}/xrpc/internal.bps.apiKey.list`, {
    headers: { cookie: c },
  })
  const lj = (await listed.json()) as {
    keys: Array<{ id: string; preview: string }>
  }
  assert.equal(lj.keys.length, 1)
  assert.equal(lj.keys[0].id, cj.id)
  assert.ok(
    !JSON.stringify(lj).includes(cj.key),
    'list never returns the secret',
  )

  const del = await fetch(`${base}/xrpc/internal.bps.apiKey.delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: c },
    body: JSON.stringify({ id: cj.id }),
  })
  assert.equal(del.status, 200)
  const listAfterDel = await fetch(`${base}/xrpc/internal.bps.apiKey.list`, {
    headers: { cookie: c },
  })
  assert.equal(
    ((await listAfterDel.json()) as { keys: unknown[] }).keys.length,
    0,
  )
})

test('apiKey.create surfaces LabelInUseError as 400 LabelInUse', async () => {
  const throwing: ApiKeyProvider = {
    ensureConsumer: async (d) => ({ did: d }),
    deleteConsumer: async () => {},
    createKey: async () => {
      throw new LabelInUseError('dupe')
    },
    listKeys: async () => [],
    deleteKey: async () => {},
  }
  const client2 = await createOAuthClient(db, cfg)
  const app2 = buildApp({ db, config: cfg, client: client2, apiKeys: throwing })
  const server2 = await new Promise<ReturnType<typeof app2.listen>>((resolve) => {
    const s = app2.listen(0, () => resolve(s))
  })
  try {
    const base2 = `http://127.0.0.1:${(server2.address() as AddressInfo).port}`
    const res = await fetch(`${base2}/xrpc/internal.bps.apiKey.create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await cookie() },
      body: JSON.stringify({ label: 'dupe' }),
    })
    assert.equal(res.status, 400)
    const body = (await res.json()) as { error: string; message: string }
    assert.equal(body.error, 'LabelInUse')
    assert.match(body.message, /label/i)
  } finally {
    await new Promise<void>((resolve) => server2.close(() => resolve()))
  }
})
