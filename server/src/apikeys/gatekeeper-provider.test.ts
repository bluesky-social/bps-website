import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { DidString } from '@atproto/syntax'
import { createGatekeeperClient } from './gatekeeper-client.ts'
import { createGatekeeperApiKeyProvider } from './gatekeeper-provider.ts'
import { LabelInUseError } from './provider.ts'
import { startFakeGatekeeper, makeGatekeeperKey, type FakeGatekeeper } from './fake-gatekeeper.ts'

const did = 'did:plc:gkprovtest' as DidString
const POLICY = {
  version: 1,
  limits: { egress_bytes: { default: { bytes: 1, period_seconds: 1, burst_bytes: 1 } } },
}

let fake: FakeGatekeeper
before(async () => {
  fake = await startFakeGatekeeper()
})
after(async () => {
  await fake.close()
})
beforeEach(() => {
  fake.requests.length = 0
})

// `db` is not used by createKey/listKeys; pass a poisoned proxy so any
// accidental database touch fails loudly.
const noDb = new Proxy({}, {
  get() {
    throw new Error('gatekeeper provider must not touch the db in this method')
  },
}) as never

function provider() {
  const client = createGatekeeperClient({
    url: fake.url,
    bearerToken: 't',
    email: 'bps@example.com',
  })
  return createGatekeeperApiKeyProvider(noDb, client, {
    service: 'jetstream',
    defaultPolicy: POLICY,
  })
}

test('createKey sends subject/name/policy and maps the created key', async () => {
  const gkKey = makeGatekeeperKey({
    subject: did,
    name: 'ci key abc12345',
    valid_until: '2030-01-01T00:00:00Z',
  })
  fake.setHandler(() => ({ status: 201, body: gkKey }))

  const created = await provider().createKey(did, {
    label: 'ci key',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
  })

  const req = fake.requests[0]
  assert.equal(req.path, '/v1/services/jetstream/keys')
  const body = req.body as Record<string, unknown>
  assert.equal(body.subject, did)
  assert.match(body.name as string, /^ci key [A-Za-z0-9_-]{8}$/)
  assert.deepEqual(body.data, POLICY)
  assert.equal(body.valid_until, '2030-01-01T00:00:00.000Z')
  assert.match(req.headers['idempotency-key'] as string, /^[0-9A-HJKMNP-TV-Z]{26}$/)

  assert.equal(created.id, gkKey.id)
  assert.equal(created.label, 'ci key')
  assert.equal(created.full, gkKey.key)
  assert.equal(created.preview, `gk_…${gkKey.key.slice(-4)}`)
  assert.equal(created.createdAt.toISOString(), '2026-08-04T00:00:00.000Z')
  assert.equal(created.expiresAt?.toISOString(), '2030-01-01T00:00:00.000Z')
})

test('each createKey uses a fresh idempotency key', async () => {
  fake.setHandler(() => ({ status: 201, body: makeGatekeeperKey() }))
  const p = provider()
  await p.createKey(did, { label: 'a', expiresAt: null })
  await p.createKey(did, { label: 'a2', expiresAt: null })
  assert.notEqual(
    fake.requests[0].headers['idempotency-key'],
    fake.requests[1].headers['idempotency-key'],
  )
})

test('createKey maps 409 name conflict to LabelInUseError', async () => {
  fake.setHandler(() => ({ status: 409, body: { title: 'Conflict' } }))
  await assert.rejects(
    provider().createKey(did, { label: 'dupe', expiresAt: null }),
    (err: unknown) => err instanceof LabelInUseError && err.label === 'dupe',
  )
})

test('createKey surfaces 422 policy rejection as a server error, not LabelInUse', async () => {
  fake.setHandler(() => ({ status: 422, body: { title: 'Unprocessable', detail: 'schema' } }))
  await assert.rejects(
    provider().createKey(did, { label: 'k', expiresAt: null }),
    (err: unknown) =>
      !(err instanceof LabelInUseError) && /default policy/i.test((err as Error).message),
  )
})

test('listKeys returns the service group mapped to ApiKeyMeta without secrets', async () => {
  const a = makeGatekeeperKey({ id: 'key_aaaaaaaaaaaaaaaaaaaaaa', name: 'first Xy12Ab34' })
  const b = makeGatekeeperKey({
    id: 'key_bbbbbbbbbbbbbbbbbbbbbb',
    name: 'second Zz98Yy76',
    valid_until: '2030-06-01T00:00:00Z',
  })
  fake.setHandler(() => ({ status: 200, body: { jetstream: [a, b], other: [makeGatekeeperKey()] } }))

  const keys = await provider().listKeys(did)
  assert.equal(fake.requests[0].path, `/v1/subjects/${encodeURIComponent(did)}/keys`)
  assert.equal(keys.length, 2)
  assert.deepEqual(
    keys.map((k) => k.label),
    ['first', 'second'],
  )
  assert.equal(keys[1].expiresAt?.toISOString(), '2030-06-01T00:00:00.000Z')
  assert.ok(!JSON.stringify(keys).includes(a.key), 'listKeys never exposes the secret')
})

test('listKeys returns [] when the subject has no keys in the service', async () => {
  fake.setHandler(() => ({ status: 200, body: {} }))
  assert.deepEqual(await provider().listKeys(did), [])
})
