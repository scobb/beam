import test from 'node:test'
import assert from 'node:assert/strict'
import { activationWindowBounds, ACTIVATION_WINDOW_MIN_HOURS, ACTIVATION_WINDOW_MAX_HOURS } from '../src/lib/activationDrip'

test('activationWindowBounds returns correct ISO strings for 20-28 hour window', () => {
  const now = new Date('2026-04-18T12:00:00Z')
  const { earliest, latest } = activationWindowBounds(now)

  // earliest = 28 hours ago
  assert.equal(earliest, '2026-04-17T08:00:00.000Z')
  // latest = 20 hours ago
  assert.equal(latest, '2026-04-17T16:00:00.000Z')
})

test('activationWindowBounds: user created 24h ago is in window', () => {
  const now = new Date('2026-04-18T12:00:00Z')
  const { earliest, latest } = activationWindowBounds(now)
  const createdAt = new Date('2026-04-17T12:00:00Z').toISOString()
  assert.ok(createdAt >= earliest, 'should be >= earliest (28h ago)')
  assert.ok(createdAt < latest, 'should be < latest (20h ago)')
})

test('activationWindowBounds: user created 30h ago is NOT in window', () => {
  const now = new Date('2026-04-18T12:00:00Z')
  const { earliest, latest } = activationWindowBounds(now)
  const createdAt = new Date('2026-04-17T06:00:00Z').toISOString()
  assert.ok(createdAt < earliest, 'should be before window (too old)')
})

test('activationWindowBounds: user created 10h ago is NOT in window', () => {
  const now = new Date('2026-04-18T12:00:00Z')
  const { earliest, latest } = activationWindowBounds(now)
  const createdAt = new Date('2026-04-18T02:00:00Z').toISOString()
  assert.ok(createdAt >= latest, 'should be after window (too recent)')
})

test('window constants are 20 and 28 hours', () => {
  assert.equal(ACTIVATION_WINDOW_MIN_HOURS, 20)
  assert.equal(ACTIVATION_WINDOW_MAX_HOURS, 28)
})
