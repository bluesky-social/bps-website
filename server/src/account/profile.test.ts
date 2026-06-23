import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import { fetchProfile } from './profile.ts'

const did = 'did:plc:profiletest' as DidString

function stubClient(profile: unknown): NodeOAuthClient {
  return {
    async restore() {
      return {
        async fetchHandler() {
          return new Response(JSON.stringify(profile), { status: 200, headers: { 'content-type': 'application/json' } })
        },
      }
    },
  } as unknown as NodeOAuthClient
}

test('fetchProfile maps the AppView getProfile response', async () => {
  const client = stubClient({ did, handle: 'alice.test', displayName: 'Alice', avatar: 'https://cdn/x.jpg' })
  const p = await fetchProfile(client, did)
  assert.deepEqual(p, { did, handle: 'alice.test', displayName: 'Alice', avatar: 'https://cdn/x.jpg' })
})

test('fetchProfile omits optional fields when absent', async () => {
  const client = stubClient({ did, handle: 'bob.test' })
  const p = await fetchProfile(client, did)
  assert.equal(p.handle, 'bob.test')
  assert.equal(p.displayName, undefined)
  assert.equal(p.avatar, undefined)
})

test('fetchProfile throws when the AppView call is not ok', async () => {
  const client = {
    async restore() {
      return { async fetchHandler() { return new Response('nope', { status: 502 }) } }
    },
  } as unknown as NodeOAuthClient
  await assert.rejects(() => fetchProfile(client, did))
})
