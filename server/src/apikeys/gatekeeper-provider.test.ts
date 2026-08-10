import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { DidString } from '@atproto/syntax'
import { createGatekeeperClient } from './gatekeeper-client.ts'
import { createGatekeeperApiKeyProvider } from './gatekeeper-provider.ts'
import { LabelInUseError } from './provider.ts'
import { startFakeGatekeeper, makeGatekeeperKey, type FakeGatekeeper } from './fake-gatekeeper.ts'
import { createDb, type DB } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'

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
    name: 'ci key',
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
  assert.equal(body.name, 'ci key')
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
  const a = makeGatekeeperKey({ id: 'key_aaaaaaaaaaaaaaaaaaaaaa', name: 'first' })
  const b = makeGatekeeperKey({
    id: 'key_bbbbbbbbbbbbbbbbbbbbbb',
    name: 'second',
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

test('listKeys excludes revoked keys and maps lifecycle status', async () => {
  const active = makeGatekeeperKey({ id: 'key_aaaaaaaaaaaaaaaaaaaaaa', name: 'live' })
  const expired = makeGatekeeperKey({
    id: 'key_bbbbbbbbbbbbbbbbbbbbbb',
    name: 'old',
    valid_until: '2020-01-01T00:00:00Z',
    current: false,
    expired: true,
  })
  const future = makeGatekeeperKey({
    id: 'key_cccccccccccccccccccccc',
    name: 'later',
    valid_from: '2099-01-01T00:00:00Z',
    current: false,
    future: true,
  })
  const revoked = makeGatekeeperKey({
    id: 'key_dddddddddddddddddddddd',
    name: 'gone',
    revoked_at: '2026-08-01T00:00:00Z',
    current: false,
    revoked: true,
  })
  fake.setHandler(() => ({
    status: 200,
    body: { jetstream: [active, expired, future, revoked] },
  }))

  const keys = await provider().listKeys(did)
  assert.deepEqual(
    keys.map((k) => [k.id, k.status]),
    [
      ['key_aaaaaaaaaaaaaaaaaaaaaa', 'active'],
      ['key_bbbbbbbbbbbbbbbbbbbbbb', 'expired'],
      ['key_cccccccccccccccccccccc', 'future'],
    ],
    'revoked keys are excluded; others carry their lifecycle status',
  )
})

test('createKey returns status active', async () => {
  fake.setHandler(() => ({ status: 201, body: makeGatekeeperKey() }))
  const created = await provider().createKey(did, { label: 'k', expiresAt: null })
  assert.equal(created.status, 'active')
})

test('listKeys returns [] when the subject has no keys in the service', async () => {
  fake.setHandler(() => ({ status: 200, body: {} }))
  assert.deepEqual(await provider().listKeys(did), [])
})

test('ensureConsumer is a no-op returning the did', async () => {
  const consumer = await provider().ensureConsumer(did)
  assert.deepEqual(consumer, { did })
  assert.equal(fake.requests.length, 0, 'no gatekeeper call made')
})

test('deleteKey revokes only keys owned by the did', async () => {
  const mine = makeGatekeeperKey({ id: 'key_mineminemineminemineab' })
  fake.setHandler((req) =>
    req.method === 'GET'
      ? { status: 200, body: { jetstream: [mine] } }
      : { status: 204 },
  )
  await provider().deleteKey(did, mine.id)
  assert.equal(fake.requests.length, 2)
  assert.equal(fake.requests[0].method, 'GET')
  assert.equal(fake.requests[1].method, 'DELETE')
  assert.equal(fake.requests[1].path, `/v1/services/jetstream/keys/${mine.id}`)
})

test('deleteKey is a no-op for keys the did does not own (no DELETE issued)', async () => {
  fake.setHandler(() => ({ status: 200, body: { jetstream: [makeGatekeeperKey()] } }))
  await provider().deleteKey(did, 'key_notmineatallnotmineaa')
  assert.equal(fake.requests.length, 1, 'only the ownership lookup, no DELETE')
})

test('deleteConsumer skips already-revoked keys', async () => {
  const dbUrl =
    process.env.BPS_TEST_DATABASE_URL ??
    'postgres://bps:bps@localhost:5433/bps_account'
  const realDb: DB = createDb(dbUrl)
  try {
    await runMigrations(realDb)
    await realDb.deleteFrom('account').where('did', '=', did).execute()
    await realDb.insertInto('account').values({ did, email: null }).execute()

    const live = makeGatekeeperKey({ id: 'key_aaaaaaaaaaaaaaaaaaaaaa' })
    const alreadyRevoked = makeGatekeeperKey({
      id: 'key_bbbbbbbbbbbbbbbbbbbbbb',
      revoked_at: '2026-08-01T00:00:00Z',
      current: false,
      revoked: true,
    })
    fake.setHandler((req) =>
      req.method === 'GET'
        ? { status: 200, body: { jetstream: [live, alreadyRevoked] } }
        : { status: 204 },
    )
    const client = createGatekeeperClient({
      url: fake.url,
      bearerToken: 't',
      email: 'bps@example.com',
    })
    const p = createGatekeeperApiKeyProvider(realDb, client, {
      service: 'jetstream',
      defaultPolicy: POLICY,
    })
    await p.deleteConsumer(did)

    const deletes = fake.requests.filter((r) => r.method === 'DELETE')
    assert.deepEqual(
      deletes.map((r) => r.path),
      ['/v1/services/jetstream/keys/key_aaaaaaaaaaaaaaaaaaaaaa'],
      'only the live key is revoked',
    )
  } finally {
    await realDb.deleteFrom('account').where('did', '=', did).execute().catch(() => {})
    await realDb.destroy()
  }
})

test('deleteKey is a no-op for an already-revoked key', async () => {
  const revoked = makeGatekeeperKey({
    id: 'key_dddddddddddddddddddddd',
    revoked_at: '2026-08-01T00:00:00Z',
    current: false,
    revoked: true,
  })
  fake.setHandler(() => ({ status: 200, body: { jetstream: [revoked] } }))
  await provider().deleteKey(did, revoked.id)
  assert.equal(fake.requests.length, 1, 'only the lookup; no DELETE for a revoked key')
})

test('deleteConsumer revokes every key then deletes the account row', async () => {
  const dbUrl =
    process.env.BPS_TEST_DATABASE_URL ??
    'postgres://bps:bps@localhost:5433/bps_account'
  const realDb: DB = createDb(dbUrl)
  try {
    await runMigrations(realDb)
    await realDb.deleteFrom('account').where('did', '=', did).execute()
    await realDb.insertInto('account').values({ did, email: null }).execute()

    const a = makeGatekeeperKey({ id: 'key_aaaaaaaaaaaaaaaaaaaaaa' })
    const b = makeGatekeeperKey({ id: 'key_bbbbbbbbbbbbbbbbbbbbbb' })
    fake.setHandler((req) =>
      req.method === 'GET'
        ? { status: 200, body: { jetstream: [a, b] } }
        : { status: 204 },
    )

    const client = createGatekeeperClient({
      url: fake.url,
      bearerToken: 't',
      email: 'bps@example.com',
    })
    const p = createGatekeeperApiKeyProvider(realDb, client, {
      service: 'jetstream',
      defaultPolicy: POLICY,
    })
    await p.deleteConsumer(did)

    const deletes = fake.requests.filter((r) => r.method === 'DELETE')
    assert.deepEqual(
      deletes.map((r) => r.path).sort(),
      [
        '/v1/services/jetstream/keys/key_aaaaaaaaaaaaaaaaaaaaaa',
        '/v1/services/jetstream/keys/key_bbbbbbbbbbbbbbbbbbbbbb',
      ],
    )
    const rows = await realDb
      .selectFrom('account')
      .selectAll()
      .where('did', '=', did)
      .execute()
    assert.equal(rows.length, 0, 'account row deleted')
  } finally {
    await realDb.deleteFrom('account').where('did', '=', did).execute().catch(() => {})
    await realDb.destroy()
  }
})

test('deleteConsumer stops loudly when a revocation fails (account row survives)', async () => {
  const dbUrl =
    process.env.BPS_TEST_DATABASE_URL ??
    'postgres://bps:bps@localhost:5433/bps_account'
  const realDb: DB = createDb(dbUrl)
  try {
    await runMigrations(realDb)
    await realDb.deleteFrom('account').where('did', '=', did).execute()
    await realDb.insertInto('account').values({ did, email: null }).execute()

    fake.setHandler((req) =>
      req.method === 'GET'
        ? { status: 200, body: { jetstream: [makeGatekeeperKey()] } }
        : { status: 502, body: { title: 'Bad Gateway' } },
    )
    const client = createGatekeeperClient({
      url: fake.url,
      bearerToken: 't',
      email: 'bps@example.com',
    })
    const p = createGatekeeperApiKeyProvider(realDb, client, {
      service: 'jetstream',
      defaultPolicy: POLICY,
    })
    await assert.rejects(p.deleteConsumer(did))

    const rows = await realDb
      .selectFrom('account')
      .selectAll()
      .where('did', '=', did)
      .execute()
    assert.equal(rows.length, 1, 'account row NOT deleted after failed revocation')
  } finally {
    await realDb.deleteFrom('account').where('did', '=', did).execute().catch(() => {})
    await realDb.destroy()
  }
})
