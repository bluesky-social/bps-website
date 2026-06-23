import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import { loadConfig } from './config.ts'
import { buildRouter } from './router.ts'

// oauth.start needs neither auth nor the DB, so a stub client + stub db suffice
// to exercise the handler's success and error branches without network or Postgres.
const cfg = loadConfig({
  BPS_PORT: '8080',
  BPS_DATABASE_URL: 'postgres://bps:bps@localhost:5433/bps_account',
  BPS_SITE_ORIGIN: 'http://localhost:3000',
  BPS_API_ORIGIN: 'http://127.0.0.1:8080',
  BPS_COOKIE_DOMAIN: 'localhost',
  BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32),
  BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
  NODE_ENV: 'development',
})
const db = {} as any

function routerWithAuthorize(authorize: NodeOAuthClient['authorize']) {
  const client = { authorize } as unknown as NodeOAuthClient
  return buildRouter({ db, config: cfg, client })
}

test('oauth.start returns 200 + authorizeUrl on success', async () => {
  const router = routerWithAuthorize(async () => new URL('https://pds.example/oauth/authorize?x=1'))
  const res = await router.fetch(
    new Request('http://local/xrpc/internal.bps.oauth.start?handle=alice.test'),
  )
  assert.equal(res.status, 200)
  const json = (await res.json()) as { authorizeUrl: string }
  assert.equal(json.authorizeUrl, 'https://pds.example/oauth/authorize?x=1')
})

test('oauth.start returns 400 (not 500) when the handle cannot be resolved', async () => {
  const router = routerWithAuthorize(async () => {
    throw new Error('handle resolution failed')
  })
  const res = await router.fetch(
    new Request('http://local/xrpc/internal.bps.oauth.start?handle=not-a-handle.invalid'),
  )
  assert.equal(res.status, 400)
  const json = (await res.json()) as { error: string }
  assert.equal(json.error, 'InvalidHandle')
})
