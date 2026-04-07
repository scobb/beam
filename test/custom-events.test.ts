import test from 'node:test'
import assert from 'node:assert/strict'
import { BEAM_JS } from '../src/routes/tracking'

test('beam.js exposes beam.track for custom events', () => {
  assert.match(BEAM_JS, /window\.beam=b/)
  assert.match(BEAM_JS, /b\.track=function/)
  assert.match(BEAM_JS, /type:'event'/)
})

test('beam.js stays under 2KB raw with custom event support', () => {
  assert.ok(Buffer.byteLength(BEAM_JS, 'utf8') < 2048)
})
