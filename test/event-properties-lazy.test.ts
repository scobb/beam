import test from 'node:test'
import assert from 'node:assert/strict'
import { eventPropertiesPanel, renderEventPropertiesTable } from '../src/routes/dashboard'

/**
 * The event-properties json_each query reads ~2,170 rows for every row it
 * returns — 2.52B rows/month and 29.8% of total D1 runtime in production, for a
 * panel most dashboard views never open. It must not run until asked for.
 */

test('eventPropertiesPanel renders a placeholder, not data', () => {
  const html = eventPropertiesPanel('/dashboard/sites/abc/event-properties?range=7d')

  assert.match(html, /Event Properties/)
  assert.match(html, /data-event-properties-load/, 'needs a trigger to fetch on demand')
  assert.match(html, /\/dashboard\/sites\/abc\/event-properties\?range=7d/)
  assert.doesNotMatch(html, /<tbody>/, 'must not render a populated table on page load')
})

test('eventPropertiesPanel escapes the fetch URL', () => {
  const html = eventPropertiesPanel('/x?range="><script>alert(1)</script>')

  assert.doesNotMatch(html, /<script>alert/)
})

test('renderEventPropertiesTable renders rows and escapes untrusted values', () => {
  const html = renderEventPropertiesTable([
    { property_key: 'plan', property_value: '<img onerror=x>', count: 1234 },
  ])

  assert.match(html, /plan/)
  assert.match(html, /1,234/, 'counts are humanised')
  assert.doesNotMatch(html, /<img onerror/, 'event property values are user-supplied')
})

test('renderEventPropertiesTable shows an empty state for no rows', () => {
  const html = renderEventPropertiesTable([])

  assert.match(html, /No data for this period/)
  assert.doesNotMatch(html, /<tbody>/)
})
