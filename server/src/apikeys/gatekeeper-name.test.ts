import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  encodeKeyName,
  parseKeyLabel,
  NAME_MAX_LENGTH,
} from './gatekeeper-name.ts'

test('encodeKeyName uses the label as the name, round-tripping unchanged', () => {
  assert.equal(encodeKeyName('my backfill key'), 'my backfill key')
  assert.equal(parseKeyLabel('my backfill key'), 'my backfill key')
})

test('encodeKeyName trims surrounding whitespace (Gatekeeper forbids it in names)', () => {
  assert.equal(encodeKeyName('  padded  '), 'padded')
})

test('encodeKeyName truncates long labels to fit Gatekeeper name limit', () => {
  const name = encodeKeyName('x'.repeat(500))
  assert.equal(name, 'x'.repeat(NAME_MAX_LENGTH))
})

test('encodeKeyName trims trailing whitespace exposed by truncation', () => {
  const label = `${'x'.repeat(NAME_MAX_LENGTH - 1)} y`
  const name = encodeKeyName(label)
  assert.equal(name, 'x'.repeat(NAME_MAX_LENGTH - 1))
})

test('encodeKeyName throws on blank labels (crash beats a malformed name)', () => {
  assert.throws(() => encodeKeyName('   '), /label/i)
})

test('parseKeyLabel returns the stored name unchanged', () => {
  assert.equal(parseKeyLabel('nospace'), 'nospace')
  assert.equal(parseKeyLabel('label with spaces'), 'label with spaces')
})
