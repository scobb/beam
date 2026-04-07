# Beam — COGS Analysis: D1 / KV / Workers on the $5 Pro Plan

**Version:** 1.0  
**Date:** 2026-04-02  
**Author:** Ralph (Keylight Digital LLC)  
**Pricing reference:** Cloudflare pricing page as of April 2026 (Workers Paid plan)

---

## 1. Architecture Overview

Beam runs entirely on the Cloudflare stack:

| Layer | Service | Purpose |
|-------|---------|---------|
| Compute | Cloudflare Workers (Hono) | Request handling, routing, rendering |
| Database | Cloudflare D1 (SQLite) | Pageview rows, users, sites |
| Cache / rate-limit | Cloudflare KV | Rate limiting, monthly usage cache, active visitors |
| Email | Resend | Signup, password-reset transactional email |
| Payments | Stripe | Pro subscription billing |

---

## 2. Cloudflare Pricing Reference (April 2026)

> **Source:** Cloudflare Workers Paid plan pricing page.  
> All numbers are monthly unless noted.

### Workers Paid — $5/month base

| Metric | Included | Overage |
|--------|----------|---------|
| Workers requests | 10M/month | $0.30/million |

### D1 (included with Workers Paid)

| Metric | Included | Overage |
|--------|----------|---------|
| Rows read | 25 billion/month | $0.001/million |
| Rows written | 50 million/month | $1.00/million |
| Storage | 5 GB | $0.75/GB-month |

### KV (included with Workers Paid)

| Metric | Included | Overage |
|--------|----------|---------|
| Reads | 10 million/month | $0.50/million |
| Writes | 1 million/month | $5.00/million |
| Deletes | 1 million/month | $5.00/million |
| Storage | 1 GB | $0.50/GB-month |

### Resend

| Plan | Limit | Cost |
|------|-------|------|
| Free | 3,000 emails/month | $0 |
| Pro | 50,000 emails/month | $20/month |

---

## 3. Per-Pageview Operation Cost

Every call to `POST /api/collect` (the tracking endpoint) performs the following operations. Two execution paths exist depending on whether the monthly-usage KV cache is warm.

### 3.1 Hot Path (monthly-usage KV cache hit — TTL: 60 s)

| Step | Operation | Count |
|------|-----------|-------|
| Worker invocation | Workers request | 1 |
| Rate limit check | KV read (`rl:{ip}`) | 1 |
| Rate limit increment | KV write (`rl:{ip}`, TTL 60 s) | 1 |
| Site + plan lookup | D1 read | 1 |
| Monthly usage check | KV read (`monthlyUsage:{uid}:{YYYY-MM}`) | 1 |
| Insert pageview | D1 write | 1 |
| Active visitor heartbeat | KV write (`active:{siteId}:{hash}`, TTL 300 s) | 1 |

**Hot path totals: 1 Workers req · 2 D1 (1R + 1W) · 4 KV (2R + 2W)**

### 3.2 Cold Path (monthly-usage KV cache miss)

Same as hot path, plus:

| Step | Operation | Count |
|------|-----------|-------|
| Fetch user's site IDs | D1 read | 1 |
| COUNT pageviews for month | D1 read | 1 |
| Write usage to KV cache | KV write (`monthlyUsage`, TTL 60 s) | 1 |

**Cold path totals: 1 Workers req · 4 D1 (3R + 1W) · 5 KV (2R + 3W)**

### 3.3 Blended Average

At low-to-medium traffic (5–50 requests/hour per site) the 60-second cache TTL yields a low hit rate — consecutive requests are often 1–10 minutes apart. Assumed **30% cache hit rate** for free users, **50%** for Pro users with higher sustained traffic.

| Metric | Free user (30% hit) | Pro user (50% hit) |
|--------|--------------------|--------------------|
| Workers requests/PV | 1.0 | 1.0 |
| D1 reads/PV | 2.4 | 2.0 |
| D1 writes/PV | 1.0 | 1.0 |
| KV reads/PV | 2.0 | 2.0 |
| KV writes/PV | 2.7 | 2.5 |

---

## 4. Scenario Modeling

### Scenario A — Low-usage free user

**Assumptions:** 100 pageviews/month · 10 dashboard visits/month

| Operation | Count | Notes |
|-----------|-------|-------|
| Workers requests | 110 | 100 PV + 10 dashboard |
| D1 reads | ~180 | 140 from PV + 40 from dashboard |
| D1 writes | 100 | 1 INSERT per PV |
| KV reads | 200 | 2 per PV |
| KV writes | ~220 | 2.7 per PV (blended) |

**Platform COGS: < $0.001** (all ops are orders of magnitude inside free tier)

---

### Scenario B — High-usage free user (near 5K/month limit)

**Assumptions:** 5,000 pageviews/month · 30 dashboard visits/month

| Operation | Count | Notes |
|-----------|-------|-------|
| Workers requests | 5,030 | |
| D1 reads | ~12,120 | 12K from PV + 120 from dashboard |
| D1 writes | 5,000 | |
| KV reads | 10,000 | |
| KV writes | ~13,500 | |

**Monthly cost contribution:** ~$0.002  
(D1: ≪ 25B limit; KV: 13.5K writes ≪ 1M included; Workers: 5K ≪ 10M)

**Revenue from this user: $0**  
A near-limit free user consumes well under 2% of any included-operation budget.

---

### Scenario C — Typical Pro user

**Assumptions:** 20,000 pageviews/month · 3 sites · 100 dashboard visits/month

| Operation | Count | Notes |
|-----------|-------|-------|
| Workers requests | 20,100 | |
| D1 reads | ~44,600 | 44K from PV + 600 from dashboard |
| D1 writes | 20,000 | |
| KV reads | 40,000 | |
| KV writes | ~50,000 | |

**Monthly cost contribution:** ~$0.004  
(All ops ≪ per-account included limits at this single-user scale)

**Revenue: $5/month**

---

## 5. Platform-Level Monthly Totals

The real cost question is at the *account* level. The following models 10, 50, and 200 Pro users with a 5:1 free-to-pro ratio and the blended operation rates from §3.3.

**Assumptions**  
- Free user average: 1,000 PV/month  
- Pro user average: 20,000 PV/month  
- Cache hit rates as per §3.3

| Scale | Pro users | Free users | Total PV/mo | Workers req | D1 reads | D1 writes | KV reads | KV writes |
|-------|-----------|-----------|-------------|-------------|----------|-----------|----------|-----------|
| Early | 10 | 50 | 250K | 250K | 550K | 250K | 500K | 660K |
| Growing | 50 | 250 | 1.25M | 1.25M | 2.75M | 1.25M | 2.5M | 3.3M |
| Scale | 200 | 1,000 | 5.0M | 5.0M | 11M | 5.0M | 10M | 13.25M |

### 5.1 Cost Against Included Limits

| Scale | Workers (10M incl.) | D1 reads (25B incl.) | D1 writes (50M incl.) | KV reads (10M incl.) | KV writes (1M incl.) |
|-------|--------------------|--------------------|---------------------|---------------------|---------------------|
| Early (250K PV) | 2.5% | < 0.01% | < 0.01% | 5% | **66%** |
| Growing (1.25M PV) | 12.5% | < 0.01% | < 0.01% | 25% | **330%** ⚠️ |
| Scale (5M PV) | 50% | < 0.01% | 0.01% | 100% | **1,325%** ⚠️ |

**Key finding:** KV writes are the only operation that materially exceeds included limits at realistic scale.

---

## 6. Gross Margin at $5/month Pro Price

### 6.1 Monthly Income Statement (account-level COGS)

| Scale | Revenue | Base cost | KV write overage | KV read overage | Workers overage | Total COGS | Gross Margin |
|-------|---------|-----------|-----------------|-----------------|-----------------|------------|--------------|
| Early (10 Pro) | $50 | $5.00 | $0.00 | $0.00 | $0.00 | **$5.00** | **90%** |
| Growing (50 Pro) | $250 | $5.00 | $11.50 | $0.00 | $0.00 | **$16.50** | **93.4%** |
| Scale (200 Pro) | $1,000 | $5.00 | $61.25 | $0.00 | $0.00 | **$66.25** | **93.4%** |

**KV write overage calc:**  
- Early: 660K writes < 1M included → $0  
- Growing: 3.3M − 1M = 2.3M × $5/M = **$11.50**  
- Scale: 13.25M − 1M = 12.25M × $5/M = **$61.25**

Gross margin stabilizes around **93%** as the platform cost ($5/mo) amortizes across more Pro users, with only the KV write overage scaling with volume.

---

## 7. Sensitivity Analysis — 2× Traffic Growth

Assumes all users double their pageview volume (free avg → 2K/mo, Pro avg → 40K/mo).

| Scale (2×) | Pro users | Total PV/mo | KV writes | KV write overage cost | Revenue | Gross Margin |
|------------|-----------|------------|-----------|----------------------|---------|--------------|
| Early 2× | 10 | 500K | 1.32M | **$1.60** | $50 | **87%** |
| Growing 2× | 50 | 2.5M | 6.5M | **$27.50** | $250 | **89%** |
| Scale 2× | 200 | 10M | 26.25M | **$126.25** | $1,000 | **87.4%** |

Margins compress slightly (~5–6 pp) at 2× traffic but remain healthy above 87%. Workers requests hit the 10M/month cap at the "Scale 2×" scenario, adding another $0.30/M for the 10M overage = $3, which is negligible.

---

## 8. Free-Tier Risk Assessment

Free users are structurally safe. A near-limit free user (5K PV/month) contributes only **~13,500 KV writes** — 1.35% of the included 1M. Even with 1,000 free users at the 5K cap:

- KV writes from free users only: 1,000 × 13,500 = 13.5M → 12.5M overage → $62.50/month

This is a significant risk **only if free users are highly active without corresponding Pro conversions.** At a 5:1 free-to-pro ratio, free users contribute ~20% of total KV writes, while Pro users contribute ~80% of writes and 100% of revenue. The model is resilient.

**Free-tier risk trigger:** If the free:pro ratio rises above 20:1 and free users are near the 5K limit, KV write overages from free users could exceed $5/Pro-user-in-revenue. Monitor this ratio.

---

## 9. Recommendations

### 9.1 Immediate (no code change needed, margin is safe today)

- **No action required at < 50 Pro users.** Total COGS is under $20/month even at 50 Pro users.
- Monitor the `KV writes` count via Cloudflare Analytics to catch overage early.

### 9.2 Short-term optimization (implement when approaching 50 Pro users)

**Reduce KV writes from ~2.7/PV to ~1.3/PV** by:

1. **Rate limiting via Durable Objects or counter batching:** Instead of a KV write on every request, use a Durable Object per IP that batches counter increments. This eliminates ~1 KV write/PV. Alternatively, skip the write if count < threshold (no write needed when count is clearly within limits).

2. **Extend monthly-usage cache TTL to 5 minutes** (from 60 s): Reduces cold-path writes significantly for low-traffic sites with no meaningful UX impact. The limit enforcement is approximate anyway; 5-minute granularity is fine.

3. **Coalesce active-visitor keys:** Instead of one KV key per visitor hash, maintain a single JSON list per site with TTL-based expiry logic in the value. Reduces KV writes from 1/PV to 1/site per 5-minute window.

**Projected impact of all three:** KV writes drop from 2.7/PV to ~0.8/PV, cutting overage cost by 70%.

### 9.3 Architectural option at large scale (200+ Pro users)

At 200 Pro users with 40K PV/month (2× baseline), consider:

- **Replace KV rate limiting with a Durable Object counter** (single write per 60-second window per IP, not per request).
- **Move monthly usage tracking to D1 only** with a longer-lived result cached in-memory per Worker instance (Workers have per-request in-memory scope — not suitable; use Cloudflare Cache API or a 5-min KV TTL).
- **D1 remains well within limits** at 50M+ rows/month included — no action needed.

### 9.4 Plan limit adjustment

The current 100K PV/month Pro cap is generous. Even at 100K PV/month:

- KV writes: 100K × 2.5 = 250K → well within 1M included per account per Pro user
- But if 200 Pro users each hit 100K PV, total KV writes = 50M → 49M overage → $245/month on $1,000 revenue (75.5% margin — still acceptable but watch closely)

**No limit change recommended** for current pricing. Re-evaluate if Pro users consistently exceed 50K PV/month.

---

## 10. Summary

| Metric | Value |
|--------|-------|
| Platform base cost | $5/month (Workers Paid) |
| Gross margin — early (10 Pro users) | **90%** |
| Gross margin — growing (50 Pro users) | **93%** |
| Gross margin — scale (200 Pro users) | **93%** |
| Gross margin — 2× traffic (200 Pro) | **87%** |
| Primary cost driver | KV writes ($5/million overage) |
| D1 / Workers headroom | Very large (< 1% of included limits at 200 Pro users) |
| First action threshold | Optimize KV writes when approaching 50 Pro users |
| Current plan limits safe? | Yes — free tier (5K PV) and Pro tier (100K PV) are both financially viable |

**Bottom line:** Beam's Cloudflare-native architecture provides excellent unit economics. At $5/month Pro pricing, gross margins exceed 90% and remain above 87% even at 2× traffic growth. The only cost to actively monitor and eventually optimize is **KV write volume** from the rate-limiting and active-visitor features. Simple TTL and batching changes (§9.2) can cut that cost by 70% before it becomes material.
