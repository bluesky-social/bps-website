import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sealData } from 'iron-session'
import { SESSION_COOKIE_NAME, unsealDidFromCookieHeader, clearCookieHeader } from './cookie.ts'

const config = { ironSessionPassword: 'x'.repeat(32) } as any
const did = 'did:plc:abc123' as any

test('unsealDidFromCookieHeader reads a sealed bps_session cookie', async () => {
  const sealed = await sealData({ did }, { password: config.ironSessionPassword })
  const header = `other=1; ${SESSION_COOKIE_NAME}=${sealed}; foo=bar`
  assert.equal(await unsealDidFromCookieHeader(header, config), did)
})

test('unsealDidFromCookieHeader returns null when cookie absent', async () => {
  assert.equal(await unsealDidFromCookieHeader('foo=bar', config), null)
  assert.equal(await unsealDidFromCookieHeader(null, config), null)
})

test('unsealDidFromCookieHeader returns null on a tampered/garbage seal', async () => {
  const header = `${SESSION_COOKIE_NAME}=not-a-valid-seal`
  assert.equal(await unsealDidFromCookieHeader(header, config), null)
})

test('clearCookieHeader produces a Max-Age=0 header for bps_session', () => {
  const header = clearCookieHeader(config)
  assert.match(header, new RegExp(`^${SESSION_COOKIE_NAME}=`))
  assert.match(header, /Max-Age=0/)
})
