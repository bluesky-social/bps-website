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
