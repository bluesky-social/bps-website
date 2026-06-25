// server/src/cors.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { corsMiddleware } from './cors.ts'

const config = { siteOrigin: 'http://localhost:3000' } as any
let server: ReturnType<express.Express['listen']>
let base: string

before(async () => {
  const app = express()
  app.use(corsMiddleware(config))
  app.get('/x', (_req, res) => res.json({ ok: true }))
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      r()
    })
  })
})
after(async () => {
  await new Promise<void>((r) => server.close(() => r()))
})

test('allows the configured origin with credentials', async () => {
  const res = await fetch(`${base}/x`, {
    headers: { origin: 'http://localhost:3000' },
  })
  assert.equal(
    res.headers.get('access-control-allow-origin'),
    'http://localhost:3000',
  )
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true')
})

test('does not reflect a foreign origin', async () => {
  const res = await fetch(`${base}/x`, {
    headers: { origin: 'http://evil.example' },
  })
  assert.notEqual(
    res.headers.get('access-control-allow-origin'),
    'http://evil.example',
  )
})

test('answers preflight OPTIONS with 204 and allow headers', async () => {
  const res = await fetch(`${base}/x`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:3000',
      'access-control-request-method': 'POST',
    },
  })
  assert.equal(res.status, 204)
  assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/)
})
