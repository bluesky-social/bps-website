import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import { sealData } from 'iron-session'
import { loadConfig } from './config.ts'
import { buildApp } from './app.ts'

// Cross-site POSTs against the account API.

const SITE_ORIGIN = 'https://bsky.network'
const VICTIM = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa'

let server: Server
let base: string
let cookie: string
let deleted: string[]
let revoked: string[]

const config = loadConfig({
  NODE_ENV: 'development',
  BPS_PORT: '8080',
  BPS_DATABASE_URL: 'postgres://bps:bps@localhost:5433/bps_account',
  BPS_SITE_ORIGIN: SITE_ORIGIN,
  BPS_API_ORIGIN: 'https://bps-api.bsky.network',
  BPS_COOKIE_DOMAIN: 'bps-api.bsky.network',
  BPS_IRON_SESSION_PASSWORD: 'x'.repeat(40),
  BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
})

// Every db call resolves empty; nothing here asserts on SQL.
function stubDb() {
  const builder = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'execute') return async () => []
        if (prop === 'executeTakeFirst') return async () => undefined
        if (prop === 'executeTakeFirstOrThrow') return async () => ({})
        return () => builder
      },
    },
  )
  return new Proxy(
    {},
    { get: () => () => builder },
  )
}

before(async () => {
  deleted = []
  revoked = []
  const app = buildApp({
    db: stubDb() as never,
    config,
    client: {
      async revoke(did: string) {
        revoked.push(did)
      },
    } as unknown as NodeOAuthClient,
    apiKeys: {
      async deleteConsumer(did: string) {
        deleted.push(did)
      },
      async listKeys() {
        return []
      },
    } as never,
  })
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      resolve()
    })
  })
  cookie = `bps_session=${await sealData({ did: VICTIM }, { password: config.ironSessionPassword })}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function crossSitePost(path: string, contentType: string, body: string) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      origin: 'https://evil.example',
      cookie,
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'navigate',
    },
    body,
  })
}

test('a cross-site form POST cannot delete the account', async () => {
  for (const contentType of [
    'application/x-www-form-urlencoded',
    'text/plain',
    'multipart/form-data; boundary=x',
  ]) {
    const res = await crossSitePost(
      '/xrpc/internal.bps.account.delete',
      contentType,
      'x=1',
    )
    assert.equal(res.status, 403, `expected 403 for ${contentType}`)
  }
  assert.deepEqual(deleted, [])
  assert.deepEqual(revoked, [])
})

test('a cross-site form POST cannot log the account out either', async () => {
  const res = await crossSitePost(
    '/xrpc/internal.bps.oauth.logout',
    'application/x-www-form-urlencoded',
    'x=1',
  )
  assert.equal(res.status, 403)
  assert.deepEqual(revoked, [])
})

test('a cross-site form with no Origin but a form content type is refused', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.account.delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie,
    },
    body: 'x=1',
  })
  assert.equal(res.status, 415)
  assert.deepEqual(deleted, [])
})

test('a JSON POST from a foreign origin is refused', async () => {
  const res = await crossSitePost(
    '/xrpc/internal.bps.account.delete',
    'application/json',
    '{}',
  )
  assert.equal(res.status, 403)
  assert.deepEqual(deleted, [])
})

test('the browser client still works: site Origin, no body, no content type', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.account.delete`, {
    method: 'POST',
    headers: { origin: SITE_ORIGIN, cookie },
  })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
  assert.deepEqual(deleted, [VICTIM])
  assert.deepEqual(revoked, [VICTIM])
})

test('a JSON POST from the site origin also deletes', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.account.delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: SITE_ORIGIN,
      cookie,
    },
    body: '{}',
  })
  assert.equal(res.status, 200)
})

test('a non-browser client with no Origin header still works', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.account.delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: '{}',
  })
  assert.equal(res.status, 200)
})
