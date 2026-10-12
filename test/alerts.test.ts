import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALERT_HISTORY_DAYS,
  averageDaily,
  calculatePercentChange,
  detectSpike,
  detectTrackingStopped,
  longestZeroRun,
} from '../src/lib/alerts'

const days = (n: number, value: number | ((i: number) => number)) =>
  Array.from({ length: n }, (_, i) => (typeof value === 'function' ? value(i) : value))

test('averageDaily handles zero days', () => {
  assert.equal(averageDaily(280, 28), 10)
  assert.equal(averageDaily(5, 0), 0)
})

test('calculatePercentChange handles baseline edge cases', () => {
  assert.equal(calculatePercentChange(10, 0), null)
  assert.equal(calculatePercentChange(6, 10), -40)
  assert.equal(calculatePercentChange(20, 10), 100)
})

test('longestZeroRun finds the longest quiet stretch', () => {
  assert.equal(longestZeroRun([1, 0, 0, 1, 0, 0, 0, 2]), 3)
  assert.equal(longestZeroRun([3, 4]), 0)
})

test('history window covers the longest streak that can still fire', () => {
  // 28 baseline days + a streak of up to 9 (8-day max normal gap, plus one).
  assert.equal(ALERT_HISTORY_DAYS, 37)
})

test('tracking stopped: an every-day site fires on its first silent day', () => {
  const daily = [...days(35, 5), 0]
  assert.deepEqual(detectTrackingStopped(daily), { quietDays: 1, longestNormalGap: 0, baselineDaily: 5 })
})

test('tracking stopped fires once per outage, not every day of it', () => {
  assert.equal(detectTrackingStopped([...days(34, 5), 0, 0]), null)
})

test('tracking stopped waits out the site\'s normal gaps', () => {
  // Weekends are dark: two-day gaps are normal, so day 3 is the first signal.
  // 28 days of five-day weeks (exactly 20 active), then a normal Mon–Fri.
  const fourWeeks = days(28, i => (i % 7 >= 5 ? 0 : 8))
  const thenWeek = [8, 8, 8, 8, 8]
  assert.equal(detectTrackingStopped([...fourWeeks, ...thenWeek, 0, 0]), null, 'an ordinary weekend')
  const fired = detectTrackingStopped([...fourWeeks, ...thenWeek, 0, 0, 0])
  assert.equal(fired?.quietDays, 3)
  assert.equal(fired?.longestNormalGap, 2)
})

test('tracking stopped ignores sites that are not reliably active', () => {
  // Active every third day: normal gaps are 2 days, so 3 silent days would
  // fire — but ~10 active days out of 28 is too sparse to call it an outage.
  const sparse = days(34, i => (i % 3 === 0 ? 4 : 0))
  assert.equal(sparse[33], 4)
  assert.equal(detectTrackingStopped([...sparse, 0, 0, 0]), null)
})

test('tracking stopped needs a full baseline', () => {
  assert.equal(detectTrackingStopped([...days(10, 5), 0]), null)
})

test('a low day that is not zero is not an outage', () => {
  assert.equal(detectTrackingStopped([...days(35, 40), 1]), null)
})

test('spikes need 10+/day, more than double, and 3 standard deviations', () => {
  assert.deepEqual(detectSpike([...days(28, 96), 300]), { pageviews: 300, baselineDaily: 96, percent: 213 })
  assert.equal(detectSpike([...days(28, 96), 190]), null, 'under double')
  assert.equal(detectSpike([...days(28, 5), 40]), null, 'too small to judge')
  // Bursty baseline: 300 on a site that regularly does 250 is not a spike.
  assert.equal(detectSpike([...days(28, i => (i % 4 === 0 ? 250 : 60)), 300]), null)
})
