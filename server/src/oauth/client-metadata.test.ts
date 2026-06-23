import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildClientMetadata } from './client-metadata.ts'

const baseConfig = {
  apiOrigin: 'https://api.example.com',
  cookieSameSite: 'none',
  devMode: false,
} as any

test('client metadata derives client_id, redirect, jwks from apiOrigin', () => {
  const m = buildClientMetadata(baseConfig)
  assert.equal(m.client_id, 'https://api.example.com/oauth-client-metadata.json')
  assert.deepEqual(m.redirect_uris, ['https://api.example.com/oauth-callback'])
  assert.equal(m.jwks_uri, 'https://api.example.com/jwks.json')
  assert.equal(m.token_endpoint_auth_method, 'private_key_jwt')
  assert.equal(m.dpop_bound_access_tokens, true)
  assert.ok(m.scope?.includes('atproto'))
  assert.ok(m.grant_types?.includes('authorization_code'))
  assert.ok(m.grant_types?.includes('refresh_token'))
})
