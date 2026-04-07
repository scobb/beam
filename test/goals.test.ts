import test from 'node:test'
import assert from 'node:assert/strict'
import { computeTrendPercent, displayReferrerSource, normalizeGoalPattern } from '../src/lib/goals'

test('normalizeGoalPattern accepts exact and wildcard path patterns', () => {
  assert.equal(normalizeGoalPattern('/thank-you'), '/thank-you')
  assert.equal(normalizeGoalPattern('checkout/*'), '/checkout/*')
})

test('normalizeGoalPattern accepts event-based patterns', () => {
  assert.equal(normalizeGoalPattern('event:signup_complete'), 'event:signup_complete')
  assert.equal(normalizeGoalPattern('event:cta-click'), 'event:cta-click')
})

test('normalizeGoalPattern rejects empty and invalid wildcard positions', () => {
  assert.equal(normalizeGoalPattern(''), null)
  assert.equal(normalizeGoalPattern('/thank*you'), null)
  assert.equal(normalizeGoalPattern('/**'), null)
  assert.equal(normalizeGoalPattern('event:'), null)
  assert.equal(normalizeGoalPattern('event:signup complete'), null)
})

test('displayReferrerSource extracts hostname when source is a URL', () => {
  assert.equal(displayReferrerSource('https://news.ycombinator.com/item?id=1'), 'news.ycombinator.com')
  assert.equal(displayReferrerSource('Direct'), 'Direct')
})

test('computeTrendPercent handles baseline-zero and normal deltas', () => {
  assert.equal(computeTrendPercent(10, 0), 100)
  assert.equal(computeTrendPercent(0, 0), null)
  assert.equal(computeTrendPercent(12, 8), 50)
})
