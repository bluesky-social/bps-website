import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createGatekeeperClient, GatekeeperError } from './gatekeeper-client.ts'
import { startFakeGatekeeper, makeGatekeeperKey, type FakeGatekeeper } from './fake-gatekeeper.ts'

let fake: FakeGatekeeper
before(async () => {
  fake = await startFakeGatekeeper()
})
after(async () => {
  await fake.close()
})

function client() {
  return createGatekeeperClient({
    url: fake.url,
    bearerToken: 'test-secret',
    email: 'bps@example.com',
  })
}

test('createKey sends auth headers, idempotency key, and body; maps response', async () => {
  fake.requests.length = 0
  const created = makeGatekeeperKey({ subject: 'did:plc:alice', name: 'my key n0nce123' })
  fake.setHandler(() => ({ status: 201, body: created }))

  const result = await client().createKey('jetstream', {
    subject: 'did:plc:alice',
    name: 'my key n0nce123',
    data: { version: 1 },
    validUntil: new Date('2030-01-01T00:00:00Z'),
    idempotencyKey: '01J0000000000000000000000',
  })

  assert.equal(result.id, created.id)
  assert.equal(result.key, created.key)

  const req = fake.requests[0]
  assert.equal(req.method, 'POST')
  assert.equal(req.path, '/v1/services/jetstream/keys')
  assert.equal(req.headers['authorization'], 'Bearer test-secret')
  assert.equal(req.headers['x-beyond-email'], 'bps@example.com')
  assert.equal(req.headers['idempotency-key'], '01J0000000000000000000000')
  assert.equal(req.headers['content-type'], 'application/json')
  assert.deepEqual(req.body, {
    subject: 'did:plc:alice',
    name: 'my key n0nce123',
    data: { version: 1 },
    valid_until: '2030-01-01T00:00:00.000Z',
  })
})

test('createKey omits valid_until when expiry is null', async () => {
  fake.requests.length = 0
  fake.setHandler(() => ({ status: 201, body: makeGatekeeperKey() }))
  await client().createKey('jetstream', {
    subject: 'did:plc:alice',
    name: 'k n0nce123',
    data: { version: 1 },
    validUntil: null,
    idempotencyKey: '01J0000000000000000000001',
  })
  assert.ok(!('valid_until' in (fake.requests[0].body as object)))
})

test('listSubjectKeys percent-encodes the subject and returns groups', async () => {
  fake.requests.length = 0
  const key = makeGatekeeperKey()
  fake.setHandler(() => ({ status: 200, body: { jetstream: [key] } }))
  const groups = await client().listSubjectKeys('did:plc:alice')
  assert.equal(fake.requests[0].method, 'GET')
  assert.equal(fake.requests[0].path, '/v1/subjects/did%3Aplc%3Aalice/keys')
  assert.equal(groups.jetstream[0].id, key.id)
})

test('revokeKey sends DELETE and accepts 204', async () => {
  fake.requests.length = 0
  fake.setHandler(() => ({ status: 204 }))
  await client().revokeKey('jetstream', 'key_0123456789abcdefghijkl')
  assert.equal(fake.requests[0].method, 'DELETE')
  assert.equal(fake.requests[0].path, '/v1/services/jetstream/keys/key_0123456789abcdefghijkl')
})

test('non-2xx responses throw GatekeeperError with status and problem details', async () => {
  fake.setHandler(() => ({
    status: 409,
    body: { type: 'https://gatekeeper.internal/problems/409', title: 'Conflict', detail: 'name exists' },
  }))
  await assert.rejects(
    client().revokeKey('jetstream', 'key_0123456789abcdefghijkl'),
    (err: unknown) => {
      assert.ok(err instanceof GatekeeperError)
      assert.equal(err.status, 409)
      assert.equal(err.problem.title, 'Conflict')
      assert.match(err.message, /409/)
      return true
    },
  )
})

test('non-JSON error bodies still produce GatekeeperError', async () => {
  fake.setHandler(() => ({ status: 502 }))
  await assert.rejects(
    client().listSubjectKeys('did:plc:alice'),
    (err: unknown) => err instanceof GatekeeperError && err.status === 502,
  )
})

test('request times out and aborts when the server never responds', async () => {
  const hanging = createServer(() => {
    // Never write a response: simulates a wedged Gatekeeper.
  })
  await new Promise<void>((resolve) => hanging.listen(0, resolve))
  try {
    const port = (hanging.address() as AddressInfo).port
    const hungClient = createGatekeeperClient({
      url: `http://127.0.0.1:${port}`,
      bearerToken: 'test-secret',
      email: 'bps@example.com',
      timeoutMs: 100,
    })
    await assert.rejects(
      hungClient.listSubjectKeys('did:plc:alice'),
      (err: unknown) =>
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError'),
    )
  } finally {
    await new Promise<void>((resolve) => hanging.close(() => resolve()))
  }
})
