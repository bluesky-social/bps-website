import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildClientMetadata } from './client-metadata.ts'
import { buildClientMetadataDoc } from './client-metadata-doc.mjs'

const baseConfig = {
  siteOrigin: 'https://site.example.com',
  apiOrigin: 'https://api.example.com',
  cookieSameSite: 'none',
  devMode: false,
} as any

test('client_id and client_uri live on the site origin', () => {
  const m = buildClientMetadata(baseConfig)
  assert.equal(
    m.client_id,
    'https://site.example.com/oauth-client-metadata.json',
  )
  assert.equal(m.client_uri, 'https://site.example.com')
})

test('redirect and jwks endpoints live on the api origin', () => {
  const m = buildClientMetadata(baseConfig)
  assert.deepEqual(m.redirect_uris, ['https://api.example.com/oauth-callback'])
  assert.equal(m.jwks_uri, 'https://api.example.com/jwks.json')
})

// The authorization server enforces both of these on a discoverable client
// (@atproto/oauth-provider validateDiscoverableClientMetadata): client_uri must
// share the client_id's origin AND be a parent URL of it. Splitting the document
// across two origins is exactly the mistake these guard against, so assert the
// invariant rather than just the literal strings above.
test('client_uri is same-origin with, and a parent of, client_id', () => {
  const m = buildClientMetadata(baseConfig)
  const clientId = new URL(m.client_id!)
  const clientUri = new URL(m.client_uri!)
  assert.equal(clientUri.origin, clientId.origin)
  assert.ok(
    clientId.pathname.startsWith(
      clientUri.pathname.endsWith('/')
        ? clientUri.pathname
        : `${clientUri.pathname}/`,
    ),
    `${clientId.pathname} must be under ${clientUri.pathname}`,
  )
})

test('client metadata carries the atproto auth requirements', () => {
  const m = buildClientMetadata(baseConfig)
  assert.equal(m.token_endpoint_auth_method, 'private_key_jwt')
  assert.equal(m.token_endpoint_auth_signing_alg, 'ES256')
  assert.equal(m.dpop_bound_access_tokens, true)
  assert.equal(m.scope, 'atproto account:email')
  assert.deepEqual(m.response_types, ['code'])
  assert.ok(m.grant_types?.includes('authorization_code'))
  assert.ok(m.grant_types?.includes('refresh_token'))
})

// The Docusaurus build passes `siteConfig.url`, which carries a trailing slash
// ("https://bsky.network/"). The server passes BPS_SITE_ORIGIN, which may not.
// Both must produce a byte-identical document: the authorization server compares
// the document's client_id against the URL it fetched it from.
test('origins are normalized so a trailing slash cannot fork the document', () => {
  const withSlashes = buildClientMetadataDoc({
    siteOrigin: 'https://site.example.com/',
    apiOrigin: 'https://api.example.com/',
  })
  assert.deepEqual(withSlashes, buildClientMetadata(baseConfig))
})

test('a missing origin throws rather than emitting a half-built document', () => {
  assert.throws(
    () => buildClientMetadataDoc({ siteOrigin: '', apiOrigin: 'https://a.example.com' }),
    /siteOrigin/,
  )
  assert.throws(
    () => buildClientMetadataDoc({ siteOrigin: 'https://a.example.com', apiOrigin: '' }),
    /apiOrigin/,
  )
})
