## Last completed
BEAM-220 - Dashboard site health indicators (deployed prod, 180/180 tests pass)

## Next up
BEAM-221 (high priority) — Update changelog with April 14, 2026 entries for BEAM-217, BEAM-218, BEAM-220.
- Hardcoded in `src/routes/changelog.ts` as `CHANGELOG: ChangelogGroup[]` array
- Add a new group `{ date: 'April 14, 2026', entries: [...] }` at the top of the array
- Tags: 'New' or 'Improvement'
- Smoke test: GET /changelog shows the April 14 group

After that: BEAM-222 (add Blog to nav), then BEAM-225 (upgrade nudge), then BEAM-223 (/for/react), BEAM-228 (per-site usage), BEAM-224 (/vs/mixpanel), BEAM-226 (UTM share), BEAM-227 (blog post).

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures.
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo — manual auth required. Steve emailed.
- Staging DNS does not resolve — run smoke tests locally or against prod only.
- Prod CF route registration errors on deploy (pre-existing — routes exist, worker upload succeeds).

## Key decisions this session
- Two-pass query strategy for BEAM-220: LEFT JOIN + 7d filter for green; second query for null results to detect yellow vs red
- Changelog is hardcoded in changelog.ts (not DB-driven) — add entries directly to the CHANGELOG array
- Resend sender must use keylightdigital.dev (not .com)
- PRD key is userStories (not stories)
