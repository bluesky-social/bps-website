// server/src/router.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDb, type DB } from './db/index.ts'
import { buildRouter } from './router.ts'

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

test('internal.bps.health responds via router.fetch', async () => {
  const router = buildRouter(db)
  const res = await router.fetch(
    new Request('http://local/xrpc/internal.bps.health'),
  )
  assert.equal(res.status, 200)
  const json = (await res.json()) as { status: string; db: unknown }
  assert.equal(json.status, 'ok')
  assert.equal(typeof json.db, 'boolean')
})
