// server/src/account/get-session.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeGetSession } from './get-session.ts'

function stubSession(behavior: string) {
  return {
    fetchHandler: async (path: string) => {
      assert.match(path, /com\.atproto\.server\.getSession/)
      if (behavior === 'throw') throw new Error('network')
      if (behavior === 'notok') return new Response('nope', { status: 502 })
      return new Response(
        JSON.stringify({ did: 'did:plc:x', handle: 'alice.test', email: 'a@b.co', emailConfirmed: true }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  }
}

test('safeGetSession returns handle + email on success', async () => {
  const r = await safeGetSession(stubSession('ok'))
  assert.equal(r.handle, 'alice.test')
  assert.equal(r.email, 'a@b.co')
})

test('safeGetSession returns {} when the call throws', async () => {
  assert.deepEqual(await safeGetSession(stubSession('throw')), {})
})

test('safeGetSession returns {} on a non-ok response', async () => {
  assert.deepEqual(await safeGetSession(stubSession('notok')), {})
})

test('safeGetSession omits email when absent', async () => {
  const session = {
    fetchHandler: async () =>
      new Response(JSON.stringify({ did: 'did:plc:x', handle: 'bob.test' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
  }
  const r = await safeGetSession(session)
  assert.equal(r.handle, 'bob.test')
  assert.equal(r.email, undefined)
})
