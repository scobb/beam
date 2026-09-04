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

/**
 * A bare "Load" button in the header reads as a broken panel. The trigger
 * belongs in the body, where the table itself will render, so the deferral
 * looks deliberate rather than like a failure state.
 */
test('eventPropertiesPanel puts the trigger where the data will appear', () => {
  const html = eventPropertiesPanel('/dashboard/sites/abc/event-properties?range=7d')

  const bodyStart = html.indexOf('data-event-properties-body')
  assert.ok(bodyStart > -1, 'panel has a body container')

  const header = html.slice(0, bodyStart)
  const body = html.slice(bodyStart)

  assert.doesNotMatch(header, /data-event-properties-load/, 'trigger must not sit in the header')
  assert.match(body, /data-event-properties-load/, 'trigger sits in the body, where the table lands')
  assert.match(html, /breakdown by properties/i, 'copy explains what loading will show')
  assert.doesNotMatch(html, />\s*Load\s*</, 'no bare "Load" label')
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
