import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { JoseKey, type RuntimeLock } from '@atproto/oauth-client-node'
import { createDb, type DB } from '../db/index.ts'
import { loadConfig, type AppConfig } from '../config.ts'
import { createOAuthClient } from './client.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

let db: DB

before(() => {
  db = createDb(url)
})
after(async () => {
  await db.destroy()
})

const baseEnv = {
  BPS_PORT: '8080',
  BPS_DATABASE_URL: url,
  BPS_IRON_SESSION_PASSWORD: 'x'.repeat(32),
  BPS_OAUTH_HANDLE_RESOLVER: 'https://bsky.social',
}

const devConfig = () =>
  loadConfig({
    ...baseEnv,
    BPS_SITE_ORIGIN: 'http://localhost:3000',
    BPS_API_ORIGIN: 'http://127.0.0.1:8080',
    BPS_COOKIE_DOMAIN: 'localhost',
    NODE_ENV: 'development',
  })

const prodConfig = async () => {
  // An ephemeral ES256 key as a JWK string, the form loadKeyset imports.
  const key = await JoseKey.generate(['ES256'], 'test-key-1')
  return loadConfig({
    ...baseEnv,
    BPS_SITE_ORIGIN: 'https://example.com',
    BPS_API_ORIGIN: 'https://api.example.com',
    BPS_COOKIE_DOMAIN: 'example.com',
    BPS_OAUTH_KEY_ID: 'test-key-1',
    BPS_OAUTH_PRIVATE_KEY: JSON.stringify(key.privateJwk),
    NODE_ENV: 'production',
  })
}

// Records what console.warn saw while building a client. The library warns
// 'No lock mechanism provided. Credentials might get revoked.' when requestLock
// is absent — the symptom this wiring exists to remove.
async function warningsWhileBuilding(
  config: AppConfig,
  requestLock: RuntimeLock,
) {
  const original = console.warn
  const warnings: string[] = []
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }
  try {
    await createOAuthClient(db, config, requestLock)
  } finally {
    console.warn = original
  }
  return warnings
}

const passthroughLock: RuntimeLock = (_name, fn) => fn()

describe('createOAuthClient', () => {
  test('wires a lock in dev mode, so no lock warning is emitted', async () => {
    const warnings = await warningsWhileBuilding(devConfig(), passthroughLock)
    assert.deepEqual(
      warnings.filter((w) => w.includes('No lock mechanism provided')),
      [],
    )
  })

  test('wires a lock in production, so no lock warning is emitted', async () => {
    const warnings = await warningsWhileBuilding(
      await prodConfig(),
      passthroughLock,
    )
    assert.deepEqual(
      warnings.filter((w) => w.includes('No lock mechanism provided')),
      [],
    )
  })
})
