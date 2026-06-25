import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDb, type DB } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { createSessionStore } from './session-store.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'
const did = 'did:plc:sessiontest' as any
let db: DB

before(async () => {
  db = createDb(url)
  await runMigrations(db)
  await db.deleteFrom('oauth_session').where('did', '=', did).execute()
})
after(async () => {
  await db.deleteFrom('oauth_session').where('did', '=', did).execute()
  await db.destroy()
})

test('session store round-trips, upserts, and deletes by DID', async () => {
  const store = createSessionStore(db)
  const v1 = { tokenSet: { access: 'a1' }, dpopJwk: { kty: 'EC' } } as any
  await store.set(did, v1)
  assert.deepEqual(await store.get(did), v1)

  const v2 = { tokenSet: { access: 'a2' }, dpopJwk: { kty: 'EC' } } as any
  await store.set(did, v2) // upsert, not duplicate
  assert.deepEqual(await store.get(did), v2)

  const rows = await db
    .selectFrom('oauth_session')
    .selectAll()
    .where('did', '=', did)
    .execute()
  assert.equal(rows.length, 1)

  await store.del(did)
  assert.equal(await store.get(did), undefined)
})
