import test from 'node:test'
import assert from 'node:assert/strict'
import { BEAM_JS } from '../src/routes/tracking'

// Regression guard for the cross-origin CORS failure.
//
// navigator.sendBeacon forces the request's credentials mode to 'include'.
// Browsers reject such credentialed requests when the collect endpoint responds
// with the wildcard `Access-Control-Allow-Origin: *`, producing:
//   "...Allow-Origin... must not be the wildcard '*' when the request's
//    credentials mode is 'include'."
// The tracking script must therefore send via fetch with credentials:'omit'
// (and keepalive for unload survival), and must NOT use sendBeacon.
test('beam.js sends collect requests without credentials and without sendBeacon', () => {
  assert.match(BEAM_JS, /credentials:'omit'/)
  assert.match(BEAM_JS, /keepalive:true/)
  assert.doesNotMatch(BEAM_JS, /sendBeacon/)
})
