import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateApiKey, hashApiKey, KEY_PREFIX } from './key.ts'

test('generateApiKey returns a prefixed key, its sha256 hash, and a masked preview', () => {
  const { full, hash, preview } = generateApiKey()
  assert.ok(full.startsWith(KEY_PREFIX), 'full key is prefixed')
  assert.equal(hash, hashApiKey(full), 'hash matches sha256 of full')
  assert.equal(hash.length, 64, 'sha256 hex is 64 chars')
  assert.ok(
    preview.startsWith(`${KEY_PREFIX}…`),
    'preview is masked with an ellipsis',
  )
  assert.ok(
    !preview.includes(full.slice(KEY_PREFIX.length, -4)),
    'preview omits the secret body',
  )
  assert.ok(
    preview.endsWith(full.slice(-4)),
    'preview ends with the last 4 chars of the full key',
  )
})

test('generateApiKey produces unique keys and hashes', () => {
  const a = generateApiKey()
  const b = generateApiKey()
  assert.notEqual(a.full, b.full)
  assert.notEqual(a.hash, b.hash)
})

test('hashApiKey is deterministic', () => {
  assert.equal(hashApiKey('jsk_abc'), hashApiKey('jsk_abc'))
})
