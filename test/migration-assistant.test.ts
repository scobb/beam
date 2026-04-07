import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMigrationPlan } from '../src/lib/migrationAssistant'
import { VENDOR_LABELS, type VendorId } from '../src/lib/stackScanner'

function detection(vendorId: VendorId) {
  return {
    vendorId,
    vendorName: VENDOR_LABELS[vendorId],
    evidence: ['test-evidence'],
  }
}

test('buildMigrationPlan returns vendor-specific recommendations for supported third-party tools', () => {
  const detections = [
    detection('google_analytics'),
    detection('google_tag_manager'),
    detection('plausible'),
    detection('fathom'),
    detection('simple_analytics'),
    detection('umami'),
    detection('matomo'),
    detection('cloudflare_web_analytics'),
    detection('vercel_analytics'),
    detection('posthog'),
    detection('goatcounter'),
  ]
  const plan = buildMigrationPlan(detections)

  assert.equal(plan.mode, 'third-party')
  assert.equal(plan.hasBeam, false)
  assert.equal(plan.recommendations.length, 11)
  assert.deepEqual(
    plan.recommendations.map((item) => item.vendorId),
    [
      'google_analytics',
      'google_tag_manager',
      'plausible',
      'fathom',
      'simple_analytics',
      'umami',
      'matomo',
      'cloudflare_web_analytics',
      'vercel_analytics',
      'posthog',
      'goatcounter',
    ]
  )
  assert.ok(plan.recommendations.every((item) => item.steps.length >= 3))
})

test('buildMigrationPlan routes Beam-only scans to verification mode', () => {
  const plan = buildMigrationPlan([detection('beam')])
  assert.equal(plan.mode, 'beam')
  assert.equal(plan.hasBeam, true)
  assert.equal(plan.recommendations.length, 0)
})

test('buildMigrationPlan marks mixed mode when Beam and third-party vendors are both detected', () => {
  const plan = buildMigrationPlan([detection('beam'), detection('plausible')])
  assert.equal(plan.mode, 'mixed')
  assert.equal(plan.hasBeam, true)
  assert.equal(plan.recommendations.length, 1)
  assert.equal(plan.recommendations[0]?.vendorId, 'plausible')
})

test('buildMigrationPlan returns none mode when no analytics tools are detected', () => {
  const plan = buildMigrationPlan([])
  assert.equal(plan.mode, 'none')
  assert.equal(plan.hasBeam, false)
  assert.equal(plan.recommendations.length, 0)
})
