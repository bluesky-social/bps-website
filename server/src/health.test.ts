// server/src/health.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDb, type DB } from './db/index.ts'
import { checkHealth } from './health.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

// Port 1 is never open; pg refuses the connection immediately (~5 ms).
const unreachableUrl = 'postgres://bps:bps@127.0.0.1:1/bps_account'

// --- db:true path ---

let db: DB

before(() => {
  db = createDb(url)
})
after(async () => {
  await db.destroy()
})

test('checkHealth returns db:true when Postgres is reachable', async () => {
  const result = await checkHealth(db)
  assert.deepEqual(result, { status: 'ok', db: true })
})

// --- db:false path (unreachable host) ---

let deadDb: DB

before(() => {
  deadDb = createDb(unreachableUrl)
})
after(async () => {
  await deadDb.destroy()
})

test('checkHealth returns db:false when Postgres is unreachable', async () => {
  const result = await checkHealth(deadDb)
  assert.deepEqual(result, { status: 'ok', db: false })
})
