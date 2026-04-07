import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiKey, hashApiKey } from '../src/lib/apiKeys'

test('createApiKey returns 32-byte hex strings', () => {
  const key = createApiKey()
  assert.equal(key.length, 64)
  assert.match(key, /^[0-9a-f]+$/)
})

test('createApiKey produces different keys across calls', () => {
  const keyA = createApiKey()
  const keyB = createApiKey()
  assert.notEqual(keyA, keyB)
})

test('hashApiKey returns deterministic SHA-256 hex', async () => {
  const input = 'beam_test_key_123'
  const hashedA = await hashApiKey(input)
  const hashedB = await hashApiKey(input)

  assert.equal(hashedA, hashedB)
  assert.equal(hashedA.length, 64)
  assert.match(hashedA, /^[0-9a-f]+$/)
  assert.notEqual(hashedA, input)
})
