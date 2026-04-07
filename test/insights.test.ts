import test from 'node:test'
import assert from 'node:assert/strict'
import { composeInsightSentences } from '../src/lib/insights'

test('composeInsightSentences returns 3-5 prioritized rule-based insights', () => {
  const insights = composeInsightSentences({
    range: '7d',
    rangeLabel: 'Last 7 Days',
    isHourly: false,
    currentPageviews: 520,
    previousPageviews: 340,
    currentUniqueVisitors: 220,
    previousUniqueVisitors: 180,
    sourcesCurrent: new Map([
      ['https://google.com/search', 120],
      ['Direct', 70],
      ['https://news.ycombinator.com', 35],
    ]),
    sourcesPrevious: new Map([
      ['https://google.com/search', 70],
      ['Direct', 82],
    ]),
    pagesCurrent: new Map([
      ['/pricing', 180],
      ['/blog/privacy', 90],
      ['/docs', 60],
    ]),
    pagesPrevious: new Map([
      ['/pricing', 95],
      ['/blog/privacy', 105],
      ['/docs', 55],
    ]),
    devicesCurrent: new Map([
      ['Mobile', 300],
      ['Desktop', 180],
    ]),
    devicesPrevious: new Map([
      ['Mobile', 150],
      ['Desktop', 190],
    ]),
    peak: { key: '2026-04-01', count: 110 },
    goalComparisons: [
      { name: 'Signup Complete', currentConverters: 34, previousConverters: 20 },
    ],
  })

  assert.ok(insights.length >= 3)
  assert.ok(insights.length <= 5)
  assert.ok(insights.some((line) => line.includes('Google') || line.includes('google')))
  assert.ok(insights.some((line) => line.includes('/pricing')))
  assert.ok(insights.some((line) => line.includes('Goal "Signup Complete"')))
})

test('composeInsightSentences provides stable fallback copy when trend candidates are sparse', () => {
  const insights = composeInsightSentences({
    range: '30d',
    rangeLabel: 'Last 30 Days',
    isHourly: false,
    currentPageviews: 0,
    previousPageviews: 0,
    currentUniqueVisitors: 0,
    previousUniqueVisitors: 0,
    sourcesCurrent: new Map(),
    sourcesPrevious: new Map(),
    pagesCurrent: new Map(),
    pagesPrevious: new Map(),
    devicesCurrent: new Map(),
    devicesPrevious: new Map(),
    peak: null,
    goalComparisons: [],
  })

  assert.equal(insights.length, 3)
  assert.match(insights[0], /Traffic stayed flat/)
})
