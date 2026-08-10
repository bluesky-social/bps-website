import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JETSTREAM_DEFAULT_POLICY } from './jetstream-policy.ts'

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
