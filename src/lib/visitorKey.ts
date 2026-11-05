/**
 * Cookieless unique-visitor keys. A "visitor" is a distinct combination of
 * coarse, non-personal attributes within one UTC day. Use these inside
 * COUNT(DISTINCT ...) so every surface (dashboard, public, API, insights,
 * goals) counts visitors the same way.
 *
 * The page path is deliberately NOT part of either key: including it counted
 * one person browsing N pages as N visitors.
 */

/** Visitor key for rows in `pageviews`. */
export const PAGEVIEW_VISITOR_KEY_SQL =
  `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(country, '') || '|' || COALESCE(browser, '') || '|' || CAST(COALESCE(screen_width, 0) AS TEXT)`

/**
 * Visitor key for rows in `custom_events`, which has no browser or
 * screen_width columns, so it is coarser than the pageview key.
 */
export const EVENT_VISITOR_KEY_SQL =
  `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(country, '') || '|' || COALESCE(referrer, '')`
