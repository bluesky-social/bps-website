// server/src/apikeys/postgres-provider.test.ts
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { DidString } from '@atproto/syntax'
import { createDb, type DB } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { createPostgresApiKeyProvider } from './postgres-provider.ts'
import { KEY_PREFIX } from './key.ts'

const url = process.env.BPS_TEST_DATABASE_URL ?? 'postgres://bps:bps@localhost:5433/bps_account'
const did = 'did:plc:keystest' as DidString
let db: DB

before(async () => {
  db = createDb(url)
  await runMigrations(db)
})
after(async () => {
  await db.deleteFrom('account').where('did', '=', did).execute()
  await db.destroy()
})
beforeEach(async () => {
  // clean slate for this DID (api_key cascades from account)
  await db.deleteFrom('account').where('did', '=', did).execute()
})

test('ensureConsumer upserts the account row idempotently', async () => {
  const p = createPostgresApiKeyProvider(db)
  const c1 = await p.ensureConsumer(did)
  assert.equal(c1.did, did)
  await p.ensureConsumer(did) // no error on second call
  const rows = await db.selectFrom('account').selectAll().where('did', '=', did).execute()
  assert.equal(rows.length, 1)
})

test('createKey returns the full secret once; listKeys never does', async () => {
  const p = createPostgresApiKeyProvider(db)
  await p.ensureConsumer(did)
  const created = await p.createKey(did, { label: 'ci', expiresAt: null })
  assert.ok(created.full.startsWith(KEY_PREFIX))
  assert.equal(created.label, 'ci')
  assert.equal(created.expiresAt, null)

  const list = await p.listKeys(did)
  assert.equal(list.length, 1)
  assert.equal(list[0].id, created.id)
  assert.equal(list[0].preview, created.preview)
  assert.ok(!('full' in list[0]), 'listKeys items carry no secret')

  // the stored hash is not the plaintext
  const row = await db.selectFrom('api_key').select(['key_hash', 'key_preview']).where('id', '=', created.id).executeTakeFirstOrThrow()
  assert.notEqual(row.key_hash, created.full)
  assert.equal(row.key_preview, created.preview)
})

test('createKey stores expiresAt when provided', async () => {
  const p = createPostgresApiKeyProvider(db)
  await p.ensureConsumer(did)
  const exp = new Date('2030-01-01T00:00:00Z')
  const created = await p.createKey(did, { label: 'temp', expiresAt: exp })
  assert.equal(created.expiresAt?.toISOString(), exp.toISOString())
})

test('deleteKey removes only that key for that DID', async () => {
  const p = createPostgresApiKeyProvider(db)
  await p.ensureConsumer(did)
  const a = await p.createKey(did, { label: 'a', expiresAt: null })
  const b = await p.createKey(did, { label: 'b', expiresAt: null })
  await p.deleteKey(did, a.id)
  const list = await p.listKeys(did)
  assert.deepEqual(list.map((k) => k.id), [b.id])
})

test('deleteConsumer cascades keys and removes the account', async () => {
  const p = createPostgresApiKeyProvider(db)
  await p.ensureConsumer(did)
  await p.createKey(did, { label: 'x', expiresAt: null })
  await p.deleteConsumer(did)
  assert.equal((await p.listKeys(did)).length, 0)
  const acct = await db.selectFrom('account').selectAll().where('did', '=', did).execute()
  assert.equal(acct.length, 0)
})
