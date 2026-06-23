import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDb, type DB } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { createStateStore } from './state-store.ts'

const url = process.env.BPS_TEST_DATABASE_URL ?? 'postgres://bps:bps@localhost:5433/bps_account'
let db: DB

before(async () => {
  db = createDb(url)
  await runMigrations(db)
  await db.deleteFrom('oauth_state').execute()
})
after(async () => {
  await db.deleteFrom('oauth_state').execute()
  await db.destroy()
})

test('state store round-trips a value and deletes it', async () => {
  const store = createStateStore(db)
  const value = { foo: 'bar', nested: { n: 1 }, dpopJwk: { kty: 'EC', crv: 'P-256' } } as any
  await store.set('key-1', value)
  const got = await store.get('key-1')
  assert.deepEqual(got, value)
  await store.del('key-1')
  assert.equal(await store.get('key-1'), undefined)
})

test('state store get returns undefined for a missing key', async () => {
  const store = createStateStore(db)
  assert.equal(await store.get('nope'), undefined)
})
