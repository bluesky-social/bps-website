// server/src/account/refresh-email.test.ts
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { DidString } from '@atproto/syntax'
import { createDb, type DB } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { refreshEmailIfStale, EMAIL_REFRESH_TTL_MS } from './refresh-email.ts'

const url = process.env.BPS_TEST_DATABASE_URL ?? 'postgres://bps:bps@localhost:5433/bps_account'
const did = 'did:plc:refreshemail' as DidString
let db: DB

// A stubbed OAuth session whose fetchHandler returns a getSession response. Mirrors
// the get-session.test.ts stub pattern — no live PDS / client.restore.
function sessionWithEmail(email: string | undefined) {
  return {
    fetchHandler: async (path: string) => {
      assert.match(path, /com\.atproto\.server\.getSession/)
      const data: Record<string, unknown> = { did, handle: 'alice.test' }
      if (email) data.email = email
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  }
}

before(async () => {
  db = createDb(url)
  await runMigrations(db)
})
after(async () => {
  await db.deleteFrom('account').where('did', '=', did).execute()
  await db.destroy()
})
beforeEach(async () => {
  await db.deleteFrom('account').where('did', '=', did).execute()
})

// Insert an account row whose updated_at is `agoMs` milliseconds in the past.
async function seed(email: string | null, agoMs: number) {
  const updatedAt = new Date(Date.now() - agoMs)
  await db
    .insertInto('account')
    .values({ did, email, created_at: updatedAt, updated_at: updatedAt })
    .execute()
  const row = await db
    .selectFrom('account')
    .select(['email', 'updated_at'])
    .where('did', '=', did)
    .executeTakeFirstOrThrow()
  return row
}

test('stale row + observed NEW email → writes new email + bumps updated_at', async () => {
  const before = await seed('old@b.co', EMAIL_REFRESH_TTL_MS + 60_000)
  let called = false
  const restore = async () => {
    called = true
    return sessionWithEmail('new@b.co')
  }
  const result = await refreshEmailIfStale(db, did, before, restore)
  assert.equal(called, true)
  assert.equal(result, 'new@b.co')
  const row = await db
    .selectFrom('account')
    .select(['email', 'updated_at'])
    .where('did', '=', did)
    .executeTakeFirstOrThrow()
  assert.equal(row.email, 'new@b.co')
  assert.ok(row.updated_at.getTime() > before.updated_at.getTime(), 'updated_at advanced')
})

test('stale row + observed SAME email → email unchanged but updated_at bumped', async () => {
  const before = await seed('same@b.co', EMAIL_REFRESH_TTL_MS + 60_000)
  const result = await refreshEmailIfStale(db, did, before, async () => sessionWithEmail('same@b.co'))
  assert.equal(result, 'same@b.co')
  const row = await db
    .selectFrom('account')
    .select(['email', 'updated_at'])
    .where('did', '=', did)
    .executeTakeFirstOrThrow()
  assert.equal(row.email, 'same@b.co')
  assert.ok(row.updated_at.getTime() > before.updated_at.getTime(), 'updated_at advanced')
})

test('stale row + observed NO email → keep last-known email, still bump updated_at', async () => {
  const before = await seed('keep@b.co', EMAIL_REFRESH_TTL_MS + 60_000)
  const result = await refreshEmailIfStale(db, did, before, async () => sessionWithEmail(undefined))
  assert.equal(result, 'keep@b.co', 'last-known email preserved')
  const row = await db
    .selectFrom('account')
    .select(['email', 'updated_at'])
    .where('did', '=', did)
    .executeTakeFirstOrThrow()
  assert.equal(row.email, 'keep@b.co')
  assert.ok(row.updated_at.getTime() > before.updated_at.getTime(), 'updated_at advanced')
})

test('stale row + restore throws → row untouched, returns stored email, no throw', async () => {
  const before = await seed('stored@b.co', EMAIL_REFRESH_TTL_MS + 60_000)
  const result = await refreshEmailIfStale(db, did, before, async () => {
    throw new Error('no session / revoked')
  })
  assert.equal(result, 'stored@b.co')
  const row = await db
    .selectFrom('account')
    .select(['email', 'updated_at'])
    .where('did', '=', did)
    .executeTakeFirstOrThrow()
  assert.equal(row.email, 'stored@b.co')
  assert.equal(row.updated_at.getTime(), before.updated_at.getTime(), 'updated_at NOT touched on failure')
})

test('stale row + getSession non-ok → row untouched, returns stored email', async () => {
  const before = await seed('stored@b.co', EMAIL_REFRESH_TTL_MS + 60_000)
  const restore = async () => ({
    fetchHandler: async () => new Response('nope', { status: 502 }),
  })
  const result = await refreshEmailIfStale(db, did, before, restore)
  assert.equal(result, 'stored@b.co')
  const row = await db
    .selectFrom('account')
    .select(['email', 'updated_at'])
    .where('did', '=', did)
    .executeTakeFirstOrThrow()
  assert.equal(row.email, 'stored@b.co')
  assert.equal(row.updated_at.getTime(), before.updated_at.getTime(), 'updated_at NOT touched')
})

test('fresh row (within TTL) → restorer NOT called, returns stored email', async () => {
  const before = await seed('fresh@b.co', EMAIL_REFRESH_TTL_MS - 60_000)
  let called = false
  const result = await refreshEmailIfStale(db, did, before, async () => {
    called = true
    return sessionWithEmail('changed@b.co')
  })
  assert.equal(called, false, 'restorer must not run for a fresh row')
  assert.equal(result, 'fresh@b.co')
})
