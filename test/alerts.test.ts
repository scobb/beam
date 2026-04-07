import test from 'node:test'
import assert from 'node:assert/strict'
import { averageDaily, calculatePercentChange, detectAnomaly, hasMinimumDataDays } from '../src/lib/alerts'

test('averageDaily and minimum day checks', () => {
  assert.equal(averageDaily(280, 28), 10)
  assert.equal(averageDaily(5, 0), 0)
  assert.equal(hasMinimumDataDays(6), false)
  assert.equal(hasMinimumDataDays(7), true)
})

test('calculatePercentChange handles baseline edge cases', () => {
  assert.equal(calculatePercentChange(10, 0), null)
  assert.equal(calculatePercentChange(6, 10), -40)
  assert.equal(calculatePercentChange(20, 10), 100)
})

test('detectAnomaly applies strict thresholds from the PRD', () => {
  assert.deepEqual(detectAnomaly(59, 100), { direction: 'down', percent: 41 })
  assert.equal(detectAnomaly(60, 100), null)

  assert.deepEqual(detectAnomaly(201, 100), { direction: 'spike', percent: 101 })
  assert.equal(detectAnomaly(200, 100), null)
})
