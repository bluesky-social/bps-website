// server/src/config.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from './config.ts'

const valid = {
  BPS_PORT: '8080',
  BPS_DATABASE_URL: 'postgres://u:p@localhost:5433/db',
  BPS_SITE_ORIGIN: 'http://localhost:3000',
  BPS_API_ORIGIN: 'http://127.0.0.1:8080',
  BPS_COOKIE_DOMAIN: 'localhost',
  BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32),
  NODE_ENV: 'test',
  BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
}

test('loadConfig parses a valid env', () => {
  const cfg = loadConfig(valid)
  assert.equal(cfg.port, 8080)
  assert.equal(cfg.databaseUrl, 'postgres://u:p@localhost:5433/db')
  assert.equal(cfg.siteOrigin, 'http://localhost:3000')
  assert.equal(cfg.nodeEnv, 'test')
})

test('loadConfig throws when a required var is missing', () => {
  const { BPS_DATABASE_URL, ...rest } = valid
  assert.throws(() => loadConfig(rest), /BPS_DATABASE_URL/)
})

test('loadConfig rejects a too-short session password', () => {
  assert.throws(
    () => loadConfig({ ...valid, BPS_IRON_SESSION_PASSWORD: 'short' }),
    /BPS_IRON_SESSION_PASSWORD/,
  )
})

test('loadConfig rejects a non-numeric port', () => {
  assert.throws(() => loadConfig({ ...valid, BPS_PORT: 'abc' }), /BPS_PORT/)
})

test('loadConfig parses oauth + cookie settings with dev defaults', () => {
  const cfg = loadConfig({
    ...valid,
    NODE_ENV: 'development',
    BPS_API_ORIGIN: 'http://127.0.0.1:8080',
  })
  assert.equal(cfg.oauthHandleResolver, 'https://bsky.social')
  assert.equal(cfg.oauthKeyId, 'bps1') // default
  assert.equal(cfg.oauthPrivateKey, null) // unset → null (ephemeral in dev)
  assert.equal(cfg.cookieSecure, false) // http + non-prod
  assert.equal(cfg.cookieSameSite, 'lax')
  assert.equal(cfg.devMode, true)
})

test('loadConfig requires BPS_OAUTH_HANDLE_RESOLVER', () => {
  const { BPS_OAUTH_HANDLE_RESOLVER, ...rest } = { ...valid }
  assert.throws(() => loadConfig(rest), /BPS_OAUTH_HANDLE_RESOLVER/)
})

test('loadConfig forces secure cookie + sameSite none in production', () => {
  const cfg = loadConfig({
    ...valid,
    NODE_ENV: 'production',
    BPS_API_ORIGIN: 'https://api.example.com',
    BPS_OAUTH_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\nMIG...\n-----END PRIVATE KEY-----',
  })
  assert.equal(cfg.cookieSecure, true)
  assert.equal(cfg.cookieSameSite, 'none')
  assert.equal(cfg.devMode, false)
  assert.ok(cfg.oauthPrivateKey?.includes('BEGIN PRIVATE KEY'))
})

test('loadConfig requires a private key in production', () => {
  assert.throws(
    () =>
      loadConfig({
        ...valid,
        NODE_ENV: 'production',
        BPS_API_ORIGIN: 'https://api.example.com',
      }),
    /BPS_OAUTH_PRIVATE_KEY/,
  )
})

test('loadConfig defaults appViewUrl to the public AppView', () => {
  const cfg = loadConfig(valid)
  assert.equal(cfg.appViewUrl, 'https://public.api.bsky.app')
})

test('loadConfig honors BPS_APPVIEW_URL override', () => {
  const cfg = loadConfig({
    ...valid,
    BPS_APPVIEW_URL: 'https://appview.example',
  })
  assert.equal(cfg.appViewUrl, 'https://appview.example')
})

test('gatekeeper config is null when no BPS_GATEKEEPER_* vars are set', () => {
  const cfg = loadConfig(valid)
  assert.equal(cfg.gatekeeper, null)
})

test('gatekeeper config parses when all three vars are set', () => {
  const cfg = loadConfig({
    ...valid,
    BPS_GATEKEEPER_URL: 'http://gatekeeper.internal:8080/',
    BPS_GATEKEEPER_BEARER_TOKEN: 'shhh',
    BPS_GATEKEEPER_EMAIL: 'bps@bsky.app',
  })
  assert.deepEqual(cfg.gatekeeper, {
    url: 'http://gatekeeper.internal:8080', // trailing slash stripped
    bearerToken: 'shhh',
    email: 'bps@bsky.app',
  })
})

test('jetstream key policy is null when unset (built-in default applies)', () => {
  const cfg = loadConfig(valid)
  assert.equal(cfg.jetstreamKeyPolicy, null)
})

test('a blank jetstream key policy is treated as unset, not as an error', () => {
  const cfg = loadConfig({ ...valid, BPS_JETSTREAM_KEY_POLICY: '   ' })
  assert.equal(cfg.jetstreamKeyPolicy, null)
})

test('jetstream key policy parses to the exact object it was given', () => {
  const policy = {
    version: 1,
    limits: {
      egress_bytes: {
        default: { bytes: 1024, period_seconds: 60, burst_bytes: 512 },
        overrides: [
          { origin: 'example', limit: { bytes: 1, period_seconds: 1, burst_bytes: 1 } },
        ],
      },
    },
  }
  const cfg = loadConfig({
    ...valid,
    BPS_JETSTREAM_KEY_POLICY: JSON.stringify(policy),
  })
  // Full replacement: what you configure is exactly what the provider sends,
  // with nothing inherited from the built-in default.
  assert.deepEqual(cfg.jetstreamKeyPolicy, policy)
})

test('malformed jetstream key policy JSON fails startup', () => {
  assert.throws(
    () => loadConfig({ ...valid, BPS_JETSTREAM_KEY_POLICY: '{not json' }),
    /BPS_JETSTREAM_KEY_POLICY/,
  )
})

test('a non-object jetstream key policy fails startup', () => {
  // Valid JSON, but nothing that could be a policy document. Catches the
  // common shell-quoting mistake at boot rather than at first key creation.
  for (const raw of ['5', '"a string"', 'null', '[]', 'true']) {
    assert.throws(
      () => loadConfig({ ...valid, BPS_JETSTREAM_KEY_POLICY: raw }),
      /BPS_JETSTREAM_KEY_POLICY/,
      `expected ${raw} to be rejected`,
    )
  }
})

test('partial gatekeeper config fails startup (no silent fallback)', () => {
  assert.throws(
    () =>
      loadConfig({
        ...valid,
        BPS_GATEKEEPER_URL: 'http://gatekeeper.internal:8080',
      }),
    /BPS_GATEKEEPER_BEARER_TOKEN/,
  )
  assert.throws(
    () =>
      loadConfig({
        ...valid,
        BPS_GATEKEEPER_BEARER_TOKEN: 'shhh',
      }),
    /BPS_GATEKEEPER_URL/,
  )
})
