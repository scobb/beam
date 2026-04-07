import type { VendorDetection, VendorId } from './stackScanner'

type ThirdPartyVendorId = Exclude<VendorId, 'beam'>

export type MigrationRecommendation = {
  vendorId: ThirdPartyVendorId
  vendorName: string
  steps: string[]
}

export type MigrationPlan = {
  mode: 'none' | 'beam' | 'mixed' | 'third-party'
  hasBeam: boolean
  thirdPartyDetections: VendorDetection[]
  recommendations: MigrationRecommendation[]
}

const MIGRATION_STEPS: Record<ThirdPartyVendorId, string[]> = {
  google_analytics: [
    'Find and remove `gtag.js`, `ga.js`, or `analytics.js` from your layout/template.',
    'Replace critical GA events with `window.beam.track(...)` calls in your product flows.',
    'Publish, then verify Beam collection on this site detail page before deleting legacy GA dashboards.',
  ],
  google_tag_manager: [
    'Open your GTM container and identify tags that fire analytics pageview/event calls.',
    'Disable analytics tags you are replacing so GTM stops sending duplicate data after Beam is live.',
    'Keep GTM only for non-analytics tags if needed, then verify Beam is your single analytics source.',
  ],
  plausible: [
    'Remove the Plausible script include from your site template or settings.',
    'Map any custom Plausible event calls to `window.beam.track(...)` where those conversions matter.',
    'Republish and confirm your first Beam hit, then archive Plausible exports for historical reference.',
  ],
  fathom: [
    'Remove the Fathom tracking script from your shared layout/template.',
    'Migrate Fathom goal/event tracking to Beam goals and `window.beam.track(...)` events.',
    'After Beam verifies traffic, retire the duplicate Fathom instrumentation to reduce script weight.',
  ],
  simple_analytics: [
    'Remove the Simple Analytics script include from your site.',
    'Recreate key conversion tracking with Beam goals or custom events.',
    'Confirm Beam data arrival in this dashboard, then keep old exports offline for history.',
  ],
  umami: [
    'Remove the Umami script from your global template.',
    'Replace `umami.track(...)` calls with `window.beam.track(...)` where needed.',
    'Validate Beam traffic and events, then disable Umami to avoid split reporting.',
  ],
  matomo: [
    'Remove Matomo/Piwik script references (`matomo.js`, `piwik.js`) from your pages.',
    'Map critical `_paq.push(...)` event goals to Beam goals/events.',
    'Once Beam verification is green, keep old Matomo exports as archive data only.',
  ],
  cloudflare_web_analytics: [
    'Disable Cloudflare Web Analytics for this zone in the Cloudflare dashboard so edge beacon events stop duplicating Beam counts.',
    'Keep only the Beam script installed, then verify first-party pageviews in Beam for the same domain.',
    'After validation, treat Beam as the single source for goals, channels, and alerts instead of splitting interpretation across dashboards.',
  ],
  vercel_analytics: [
    'Remove Vercel Analytics instrumentation (`@vercel/analytics` or `/_vercel/insights` script) from your app layout.',
    'Map key `va.track(...)` usage to `window.beam.track(...)` for the conversions you care about.',
    'Deploy, verify Beam events/pageviews, then retire duplicate Vercel analytics reporting for this property.',
  ],
  posthog: [
    'Remove the PostHog client snippet (`posthog.init(...)` / `array.js`) from your frontend bundle or templates.',
    'Recreate the high-signal product or marketing events you still need with Beam custom events/goals.',
    'Confirm Beam captures the replacement events, then disable redundant PostHog page analytics for this site.',
  ],
  goatcounter: [
    'Remove GoatCounter script references (for example `gc.zgo.at/count.js` or custom `data-goatcounter` tags) from shared templates.',
    'Replace any GoatCounter event hooks with Beam goals or `window.beam.track(...)` where needed.',
    'Publish and verify Beam collection before turning off the old GoatCounter dashboard workflow.',
  ],
}

export function buildMigrationPlan(detections: VendorDetection[]): MigrationPlan {
  const hasBeam = detections.some((detection) => detection.vendorId === 'beam')
  const thirdPartyDetections = detections.filter((detection) => detection.vendorId !== 'beam')

  const recommendations = thirdPartyDetections
    .map((detection): MigrationRecommendation | null => {
      if (detection.vendorId === 'beam') return null
      return {
        vendorId: detection.vendorId,
        vendorName: detection.vendorName,
        steps: MIGRATION_STEPS[detection.vendorId],
      }
    })
    .filter((item): item is MigrationRecommendation => item !== null)

  let mode: MigrationPlan['mode'] = 'none'
  if (hasBeam && thirdPartyDetections.length === 0) mode = 'beam'
  else if (hasBeam && thirdPartyDetections.length > 0) mode = 'mixed'
  else if (!hasBeam && thirdPartyDetections.length > 0) mode = 'third-party'

  return {
    mode,
    hasBeam,
    thirdPartyDetections,
    recommendations,
  }
}
