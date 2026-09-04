import test from 'node:test'
import assert from 'node:assert/strict'
import { PUBLIC_DASH_REFRESH_JS, PUBLIC_DASH_REFRESH_MIN_AGE_MS } from '../src/routes/public'

/**
 * The public dashboard used to run `setTimeout(()=>location.reload(), 60000)`
 * unconditionally, with `Cache-Control: no-store`. A single forgotten tab
 * therefore re-ran the full 16-query analytics batch 1,440 times a day.
 * Production showed ~114,000 renders in 30 days from a handful of open tabs.
 *
 * These tests execute the real inline script against stubbed browser globals.
 */

interface Harness {
  reloads: number
  tick: () => void
  becomeVisible: () => void
  setHidden: (hidden: boolean) => void
  advance: (ms: number) => void
}

function runRefreshScript(): Harness {
  let now = 1_000_000
  let hidden = false
  let reloads = 0
  const listeners: Record<string, (() => void)[]> = {}
  let intervalFn: (() => void) | null = null

  const documentStub = {
    get hidden() { return hidden },
    addEventListener(name: string, fn: () => void) {
      (listeners[name] ??= []).push(fn)
    },
  }
  const locationStub = { reload() { reloads++ } }
  const setIntervalStub = (fn: () => void) => { intervalFn = fn; return 1 }
  const DateStub = { now: () => now }

  const fn = new Function('document', 'location', 'setInterval', 'Date', PUBLIC_DASH_REFRESH_JS)
  fn(documentStub, locationStub, setIntervalStub, DateStub)

  return {
    get reloads() { return reloads },
    tick: () => intervalFn?.(),
    becomeVisible: () => {
      hidden = false
      for (const fn of listeners['visibilitychange'] ?? []) fn()
    },
    setHidden: (value: boolean) => { hidden = value },
    advance: (ms: number) => { now += ms },
  } as Harness
}

test('a hidden tab never reloads, however long it is left open', () => {
  const page = runRefreshScript()
  page.setHidden(true)

  page.advance(PUBLIC_DASH_REFRESH_MIN_AGE_MS * 100)
  for (let i = 0; i < 500; i++) page.tick()

  assert.equal(page.reloads, 0, 'a forgotten background tab must cost nothing')
})

test('a visible tab does not reload before the minimum age', () => {
  const page = runRefreshScript()

  page.advance(PUBLIC_DASH_REFRESH_MIN_AGE_MS - 1)
  page.tick()

  assert.equal(page.reloads, 0)
})

test('a visible tab reloads once it is older than the minimum age', () => {
  const page = runRefreshScript()

  page.advance(PUBLIC_DASH_REFRESH_MIN_AGE_MS)
  page.tick()

  assert.equal(page.reloads, 1)
})

test('a stale hidden tab refreshes as soon as it becomes visible again', () => {
  const page = runRefreshScript()
  page.setHidden(true)
  page.advance(PUBLIC_DASH_REFRESH_MIN_AGE_MS * 10)
  page.tick()
  assert.equal(page.reloads, 0)

  page.becomeVisible()

  assert.equal(page.reloads, 1, 'returning to a stale tab should show fresh data')
})

test('refresh interval is at least five minutes', () => {
  assert.ok(
    PUBLIC_DASH_REFRESH_MIN_AGE_MS >= 300_000,
    `expected >= 300000ms, got ${PUBLIC_DASH_REFRESH_MIN_AGE_MS}`
  )
})
