import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sealData } from 'iron-session'
import { makeRequireSession } from './auth.ts'
import { SESSION_COOKIE_NAME } from './cookie.ts'

const config = { ironSessionPassword: 'x'.repeat(32) } as any
const did = 'did:plc:authtest' as any

test('requireSession returns {did} for a valid cookie', async () => {
  const requireSession = makeRequireSession(config)
  const sealed = await sealData({ did }, { password: config.ironSessionPassword })
  const request = new Request('http://local/xrpc/internal.bps.account.whoami', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${sealed}` },
  })
  const creds = await requireSession({ request })
  assert.equal(creds.did, did)
})

test('requireSession throws when no cookie present', async () => {
  const requireSession = makeRequireSession(config)
  const request = new Request('http://local/xrpc/internal.bps.account.whoami')
  await assert.rejects(() => requireSession({ request }), /Authentication|auth|session/i)
})
