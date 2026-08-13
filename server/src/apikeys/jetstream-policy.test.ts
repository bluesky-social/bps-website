import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  JETSTREAM_DEFAULT_POLICY,
  resolveJetstreamPolicy,
} from './jetstream-policy.ts'

const MAX_BYTES = 2 ** 60
const MAX_PERIOD_SECONDS = 366 * 24 * 60 * 60

test('default policy matches headwind policy v1 shape exactly', () => {
  assert.deepEqual(Object.keys(JETSTREAM_DEFAULT_POLICY).sort(), ['limits', 'version'])
  assert.equal(JETSTREAM_DEFAULT_POLICY.version, 1)
  assert.deepEqual(Object.keys(JETSTREAM_DEFAULT_POLICY.limits), ['egress_bytes'])
  assert.deepEqual(Object.keys(JETSTREAM_DEFAULT_POLICY.limits.egress_bytes), ['default'])
  const limit = JETSTREAM_DEFAULT_POLICY.limits.egress_bytes.default
  assert.deepEqual(Object.keys(limit).sort(), ['burst_bytes', 'bytes', 'period_seconds'])
  for (const [k, v] of Object.entries(limit)) {
    assert.ok(Number.isSafeInteger(v) && v >= 1, `${k} must be a positive integer`)
  }
  assert.ok(limit.bytes <= MAX_BYTES)
  assert.ok(limit.burst_bytes <= MAX_BYTES)
  assert.ok(limit.period_seconds <= MAX_PERIOD_SECONDS)
})

test('default policy survives a JSON round trip unchanged', () => {
  // The built-in default and a BPS_JETSTREAM_KEY_POLICY document reach
  // Gatekeeper through the same field, so the built-in must be plain JSON —
  // no undefined, no bigint, nothing that serializes differently.
  assert.deepEqual(
    JSON.parse(JSON.stringify(JETSTREAM_DEFAULT_POLICY)),
    JETSTREAM_DEFAULT_POLICY,
  )
})

test('resolveJetstreamPolicy falls back to the built-in default when unconfigured', () => {
  assert.deepEqual(resolveJetstreamPolicy(null), {
    policy: JETSTREAM_DEFAULT_POLICY,
    source: 'built-in',
  })
})

test('resolveJetstreamPolicy replaces the default outright when configured', () => {
  // Deliberately a partial document: nothing may be inherited from the
  // built-in default, so this comes back exactly as given.
  const configured = { version: 1 }
  assert.deepEqual(resolveJetstreamPolicy(configured), {
    policy: configured,
    source: 'config',
  })
})
