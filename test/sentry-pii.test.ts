import test from 'node:test'
import assert from 'node:assert/strict'
import { scrubEventPII } from '../src/lib/sentry'
import type { ErrorEvent } from '@sentry/cloudflare'

function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    event_id: 'test-event-id',
    level: 'error',
    message: 'Test error',
    ...overrides,
  } as ErrorEvent
}

test('scrubEventPII removes Authorization header value', () => {
  const event = makeEvent({
    request: { headers: { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' } },
  })
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.equal(result.request?.headers?.['Authorization'], '[Filtered]')
  assert.equal(result.request?.headers?.['Content-Type'], 'application/json')
})

test('scrubEventPII removes Cookie header value', () => {
  const event = makeEvent({
    request: { headers: { cookie: 'beam_session=super-secret-jwt; other=value' } },
  })
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.equal(result.request?.headers?.['cookie'], '[Filtered]')
})

test('scrubEventPII clears cookies object', () => {
  const event = makeEvent({
    request: { cookies: { beam_session: 'secret-jwt', pref: 'dark-mode' } },
  })
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.deepEqual(result.request?.cookies, {})
})

test('scrubEventPII strips email from user context', () => {
  const event = makeEvent({
    user: { id: 'user-123', email: 'user@example.com', username: 'alice' },
  })
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.equal(result.user?.id, 'user-123')
  assert.equal(result.user?.email, undefined)
  assert.equal(result.user?.username, undefined)
})

test('scrubEventPII removes ip_address from user context', () => {
  const event = makeEvent({
    user: { id: 'user-456', ip_address: '203.0.113.1' },
  })
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.equal(result.user?.id, 'user-456')
  assert.equal(result.user?.ip_address, undefined)
})

test('scrubEventPII passes through events with no PII', () => {
  const event = makeEvent({
    message: 'Database timeout',
    request: { url: '/api/collect', method: 'POST', headers: { 'Content-Type': 'application/json' } },
  })
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.equal(result.message, 'Database timeout')
  assert.equal(result.request?.url, '/api/collect')
})

test('scrubEventPII handles missing request and user gracefully', () => {
  const event = makeEvent()
  const result = scrubEventPII(event)
  assert.ok(result)
  assert.equal(result.message, 'Test error')
})
