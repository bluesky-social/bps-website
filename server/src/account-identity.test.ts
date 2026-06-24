// server/src/account-identity.test.ts
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'kysely'
import type { DidString } from '@atproto/syntax'
import { createDb, type DB } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'

const url = process.env.BPS_TEST_DATABASE_URL ?? 'postgres://bps:bps@localhost:5433/bps_account'
const did = 'did:plc:identitytest' as DidString
let db: DB

// Mirrors the callback upsert so we test the SQL semantics directly.
async function upsertIdentity(d: DidString, handle?: string, email?: string) {
  await db.insertInto('account')
    .values({ did: d, handle: handle ?? null, email: email ?? null })
    .onConflict((oc) => oc.column('did').doUpdateSet({
      handle: sql`coalesce(excluded.handle, account.handle)`,
      email: sql`coalesce(excluded.email, account.email)`,  // PDS observation wins; keep last-known on NULL
      updated_at: sql`now()`,
    }))
    .execute()
}

before(async () => { db = createDb(url); await runMigrations(db) })
after(async () => { await db.deleteFrom('account').where('did', '=', did).execute(); await db.destroy() })
beforeEach(async () => { await db.deleteFrom('account').where('did', '=', did).execute() })

test('first login stores handle + stores email from PDS', async () => {
  await upsertIdentity(did, 'alice.test', 'a@b.co')
  const row = await db.selectFrom('account').select(['handle', 'email']).where('did', '=', did).executeTakeFirstOrThrow()
  assert.equal(row.handle, 'alice.test')
  assert.equal(row.email, 'a@b.co')
})

test('re-login with new observed email OVERWRITES stored email (handle also refreshes)', async () => {
  await upsertIdentity(did, 'alice.test', 'a@b.co')
  await upsertIdentity(did, 'alice2.test', 'different@x.co') // handle changed, new email observed from PDS
  const row = await db.selectFrom('account').select(['handle', 'email']).where('did', '=', did).executeTakeFirstOrThrow()
  assert.equal(row.handle, 'alice2.test', 'handle refreshed')
  assert.equal(row.email, 'different@x.co', 'PDS-observed email overwrites stored copy')
})

test('re-login with no atproto email keeps the stored handle and last-known email (non-observation guard)', async () => {
  await upsertIdentity(did, 'alice.test', 'a@b.co')
  await upsertIdentity(did, undefined, undefined) // getSession failed / PDS did not share email
  const row = await db.selectFrom('account').select(['handle', 'email']).where('did', '=', did).executeTakeFirstOrThrow()
  assert.equal(row.handle, 'alice.test', 'handle retained when new handle absent')
  assert.equal(row.email, 'a@b.co', 'keep-last-known: NULL non-observation must never overwrite stored email')
})

test('email fills/refreshes from PDS on a later login if it was null before', async () => {
  await upsertIdentity(did, 'alice.test', undefined) // first login, no email granted
  await upsertIdentity(did, 'alice.test', 'late@x.co') // later granted
  const row = await db.selectFrom('account').select('email').where('did', '=', did).executeTakeFirstOrThrow()
  assert.equal(row.email, 'late@x.co', 'email fills when previously null')
})
