import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDb, type DB } from './index.ts'
import { runMigrations } from './migrate.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

let db: DB

// NOTE: this suite's before() drops every table on the shared dev database to
// test migrations from a clean slate. That is destructive to any other
// DB-integration test running against the same database, so the test runner is
// pinned to `--test-concurrency=1` (see package.json "test" script). If this
// test is ever given its own database/schema, that pin can be relaxed.
before(async () => {
  db = createDb(url)
  // Clean slate: drop tables + the migration bookkeeping if present.
  await db.schema.dropTable('api_key').ifExists().execute()
  await db.schema.dropTable('oauth_session').ifExists().execute()
  await db.schema.dropTable('oauth_state').ifExists().execute()
  await db.schema.dropTable('account').ifExists().execute()
  await db.schema.dropTable('kysely_migration').ifExists().execute()
  await db.schema.dropTable('kysely_migration_lock').ifExists().execute()
})

after(async () => {
  await db.destroy()
})

test('runMigrations creates all four tables', async () => {
  await runMigrations(db)

  const tables = await db.introspection.getTables()
  const names = tables.map((t) => t.name).sort()
  for (const expected of ['account', 'api_key', 'oauth_session', 'oauth_state']) {
    assert.ok(names.includes(expected), `missing table ${expected}`)
  }
})

test('api_key.did cascades on account delete', async () => {
  await db
    .insertInto('account')
    .values({ did: 'did:plc:test123' as never, email: null })
    .execute()
  await db
    .insertInto('api_key')
    .values({
      id: 'k1',
      did: 'did:plc:test123' as never,
      label: 'l',
      key_hash: 'h',
      key_preview: 'jsk_...abcd',
      expires_at: null,
      last_used_at: null,
    })
    .execute()

  await db.deleteFrom('account').where('did', '=', 'did:plc:test123' as never).execute()

  const keys = await db.selectFrom('api_key').selectAll().execute()
  assert.equal(keys.length, 0, 'api_key rows should cascade-delete')
})
