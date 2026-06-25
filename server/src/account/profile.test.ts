import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { DidString } from '@atproto/syntax'
import { fetchProfile } from './profile.ts'

const did = 'did:plc:profiletest' as DidString
const APPVIEW = 'https://public.api.bsky.app'
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('fetchProfile hits the public AppView getProfile and maps fields', async () => {
  let calledUrl = ''
  globalThis.fetch = (async (url) => {
    calledUrl = String(url)
    return new Response(
      JSON.stringify({
        did,
        handle: 'alice.test',
        displayName: 'Alice',
        avatar: 'https://cdn/x.jpg',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as typeof fetch
  const p = await fetchProfile(APPVIEW, did)
  assert.ok(
    calledUrl.startsWith(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=`),
  )
  assert.deepEqual(p, {
    did,
    handle: 'alice.test',
    displayName: 'Alice',
    avatar: 'https://cdn/x.jpg',
  })
})

test('fetchProfile omits optional fields when absent', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ did, handle: 'bob.test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
  const p = await fetchProfile(APPVIEW, did)
  assert.equal(p.handle, 'bob.test')
  assert.equal(p.displayName, undefined)
  assert.equal(p.avatar, undefined)
})

test('fetchProfile throws when the AppView responds non-ok', async () => {
  globalThis.fetch = (async () =>
    new Response('no', { status: 404 })) as typeof fetch
  await assert.rejects(() => fetchProfile(APPVIEW, did))
})
