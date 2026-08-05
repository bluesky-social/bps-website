import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  encodeKeyName,
  parseKeyLabel,
  NAME_MAX_LENGTH,
  NONCE_LENGTH,
} from './gatekeeper-name.ts'

test('encodeKeyName appends a nonce and round-trips through parseKeyLabel', () => {
  const name = encodeKeyName('my backfill key')
  assert.match(name, /^my backfill key [A-Za-z0-9_-]{8}$/)
  assert.equal(parseKeyLabel(name), 'my backfill key')
})

test('nonces differ between calls (uniqueness under Gatekeeper name constraint)', () => {
  assert.notEqual(encodeKeyName('same label'), encodeKeyName('same label'))
})

test('encodeKeyName trims surrounding whitespace (Gatekeeper forbids it in names)', () => {
  const name = encodeKeyName('  padded  ')
  assert.match(name, /^padded [A-Za-z0-9_-]{8}$/)
  assert.equal(parseKeyLabel(name), 'padded')
})

test('encodeKeyName truncates long labels so the name fits 128 chars', () => {
  const name = encodeKeyName('x'.repeat(500))
  assert.equal(name.length, NAME_MAX_LENGTH)
  assert.equal(parseKeyLabel(name), 'x'.repeat(NAME_MAX_LENGTH - 1 - NONCE_LENGTH))
})

test('encodeKeyName throws on blank labels (crash beats a malformed name)', () => {
  assert.throws(() => encodeKeyName('   '), /label/i)
})

test('parseKeyLabel returns names without a space unchanged', () => {
  assert.equal(parseKeyLabel('nospace'), 'nospace')
})
