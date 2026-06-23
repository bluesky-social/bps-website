import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createDb, type DB } from './db/index.ts'
import { buildApp } from './app.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

let db: DB
let server: Server
let base: string

before(async () => {
  db = createDb(url)
  const app = buildApp(db)
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo
      base = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await db.destroy()
})

test('GET /healthz returns 200 ok', async () => {
  const res = await fetch(`${base}/healthz`)
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.status, 'ok')
})

test('GET /xrpc/internal.bps.health returns 200 through Express mount', async () => {
  const res = await fetch(`${base}/xrpc/internal.bps.health`)
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.status, 'ok')
  assert.equal(typeof json.db, 'boolean')
})
