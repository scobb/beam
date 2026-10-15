# Beam — Claude Code Guide

Also read `AGENTS.md`: it holds the deploy workflow, the sitemap/IndexNow steps
and the per-feature guardrails. This file covers *how to work* in this repo and
the traps that have actually caused incidents.

## Verification bar

`npm run typecheck` and `npm run test` are the floor, not the bar. Before
calling anything done:

- Run `npm run test:smoke` — 128 Playwright tests across desktop and mobile.
  It catches what unit tests structurally cannot.
- Drive the real thing in a browser. A route returning 200 is not evidence the
  feature works, and a rendered button is not evidence it does anything.
- **Prove the guard fails.** A test written after the code passes immediately,
  which proves nothing. Break the thing deliberately, watch the test go red,
  then restore it. If it never went red, it is not protecting you.

Blast radius is set by the code you touch, not by your intent. A "diagnostic"
or "one-line" change to a hot path earns the same QA as a feature.

## Analytics dashboards — the highest-risk area

`/public/:site_id` (`routes/public.ts`) and `/dashboard/sites/:id/analytics`
(`routes/dashboard.ts`) each run a ~16-statement `DB.batch([...])`. This is the
most expensive and most fragile code in the repo.

- **Batch results are read positionally** (`batchRes[11]`, `batchRes[15]`).
  Adding or removing a statement silently reassigns every later index. Nothing
  throws — country names just start appearing under "Browsers".
- **Test index shifts with non-uniform data.** If every seeded row shares a
  country/browser/device, a shift is invisible. Give each dimension a distinct
  signature *and* distinct visitor counts — panels sort by visitors, so ties
  reorder arbitrarily and read as false failures.
- **`routes/public.ts` renders TWO different pages**: the public dashboard and
  the `/embed/:siteId` widget, as separate templates in one file. Check which
  one you are editing. A script added to the wrong template fails silently —
  the page still renders, the button just does nothing.
- Both dashboards issue textually identical SQL, so D1 Insights merges them.
  Tag statements with `taggedSql(sql, 'public' | 'app')` to keep them apart.

## D1 cost is measured in rows, not queries

D1 bills **rows scanned**. `COGS-REPORT.md`, `docs/cogs-analysis.md` and
`cost-ceiling.md` all count queries instead, so their numbers are wrong by
orders of magnitude. Do not trust them; get real figures from D1 Insights.

- An unbounded `WHERE site_id = ?` scans a site's entire history on every call
  and grows forever. Use `LIMIT 1` to test existence, and a bare `MIN(col)` for
  extremes — `MIN(fn(col))` defeats the index and forces a full scan.
- D1 has a **hard 10 GB per-database cap** on Workers Paid. Measured row size is
  ~157 bytes, and there is no retention policy.
- KV writes are the tightest budget. Never "fix" a D1 read cost by adding a KV
  write; prefer not doing the work at all (defer it, or skip it).

## Deploying

- **A green PR is not evidence anything shipped.** `Typecheck & Test` can pass
  while `Deploy to Cloudflare Workers` fails underneath. Four merges once went
  undeployed this way. After merging, check the deploy job *and* probe
  production for the change.
- CI runs `wrangler deploy` only, while `deploy.sh` also runs
  `d1 migrations apply --remote`. **CI does not apply migrations** — a PR that
  adds one needs a manual `npm run deploy`.

## Never let non-prod write to production

Marketing pages emit an absolute `beam.js` URL built from `PUBLIC_BASE_URL`,
which is unset in every `wrangler.toml` and falls back to
`https://beam-privacy.com`. So `wrangler dev` and `npm run test:smoke` write
real pageviews into production analytics unless you set it:

```bash
npx wrangler dev --port 8787 --var PUBLIC_BASE_URL:http://localhost:8787
```

The smoke suite starts its **own** server on port 8787 when nothing is already
listening there — so running your dev server on any other port does not protect
you. Beam's own dogfood numbers already contain this contamination.
