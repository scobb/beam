# Beam Cost Ceiling Analysis

**Last updated:** 2026-04-04  
**Scope:** `/api/collect` endpoint under sustained adversarial traffic

---

## Cloudflare Pricing Reference

| Resource | Free tier | Paid rate |
|---|---|---|
| KV reads | 10M/day | $0.50/million |
| KV writes | 1M/day | $5.00/million |
| D1 reads | 25M/day | $0.001/million |
| D1 writes | 50K/day | $1.00/million |
| Worker requests | 100K/day | $0.30/million |

---

## Controls in Place (as of BEAM-150)

### 1. In-memory per-IP rate limiter
- **Cap:** 100 requests/minute per IP
- **KV cost:** $0 (no KV reads or writes)
- **Effect:** Limits any single IP to 100 req/min regardless of attack scale

### 2. Global in-memory daily cap
- **Cap:** 500,000 requests/day per Worker isolate
- **KV cost:** $0 (pure in-memory; once `globalCapExceeded = true`, returns 503 with zero I/O)
- **Note:** Per-isolate; Cloudflare may run multiple isolates so the practical global cap is
  `500K × number_of_active_isolates`. Under low traffic (typical), 1–2 isolates → ~1M/day ceiling.

### 3. Free-user daily pageview cap (5,000/day)
- **KV reads:** 1 per request (for free users, pageviews only)
- **KV writes:** 1 per 5-minute cache window (on cache miss only — read-then-write pattern)
- **Effect:** Free accounts cannot receive more than 5K pageviews/day before returning 402

### 4. Monthly pageview limit (existing)
- **KV reads:** 1 per request (cached, 60s TTL)
- **KV writes:** 1 per 60-second cache window (on cache miss only)
- **Caps:** 50K/month (free), 500K/month (pro)

### 5. Active-visitor read-then-write
- **Old pattern:** 1 KV write per pageview
- **New pattern:** 1 KV read per pageview; 1 KV write per unique visitor per 5-minute window
- **Savings:** For a user refreshing every 30 seconds, previous cost was 10 writes/5 min; now it's 1 write/5 min — **10× reduction**

### 6. Origin/Referer domain validation
- **Effect:** Rejects requests where the HTTP Origin or Referer header does not match the registered site domain
- **Bypass vector:** Attacker can spoof the Origin header (HTTP header forgery is trivial in server-to-server requests)
- **Residual value:** Blocks naive script-kiddie attacks and browser-based cross-site abuse; does not block determined attackers who craft headers

---

## Worst-Case Cost Model

### Assumptions (adversarial scenario)
- Attacker controls a botnet of 10,000 distinct IPs
- Each IP sends 100 req/min (at rate limit ceiling)
- Attack runs 24 hours/day
- All requests pass site validation (attacker knows a valid `site_id`)
- The global per-isolate cap is the binding ceiling

### Without any controls (baseline)
- 10,000 IPs × 100 req/min × 60 min/hr × 24 hr = **1.44 billion requests/day**
- KV writes (rate limit + active visitor): ~2 per request = **2.88 billion writes/day**
- Cost: 2,880,000 writes × $5/million = **$14,400/day** ← catastrophic

### With BEAM-150 controls
| Cost item | Calculation | Daily cost |
|---|---|---|
| Worker requests | Capped at ~1M/day (per-isolate global cap) | ~$0.30 |
| KV reads (rate limit) | 0 (in-memory) | $0.00 |
| KV writes (rate limit) | 0 (in-memory) | $0.00 |
| KV reads (daily cap) | 1M reads (all blocked after threshold) | $0.50 |
| KV writes (daily cap) | ~200 writes (1 per 5-min window per user) | ~$0.001 |
| KV reads (monthly) | ~100K reads (only for legitimate-looking requests) | $0.05 |
| KV reads (active visitor) | 1M reads max (1 per passing request) | $0.50 |
| KV writes (active visitor) | ~10K writes (once per 5-min per visitor hash) | $0.05 |
| D1 reads (site query) | ~1M rows read | ~$0.001 |
| D1 writes (pageviews) | Bounded by monthly limits × user count | <$0.01 |
| **Total daily** | | **~$1.40/day** |
| **Total monthly** | | **~$42/month** |

### Notes
- The global per-isolate cap is the single most important protection: it bounds total requests to ~1M/day, 
  which caps all downstream KV and D1 costs.
- If Cloudflare spins up 10 isolates under attack, the actual cap becomes ~10M/day and the worst-case 
  monthly cost rises to ~$420. Still catastrophic for a bootstrapped product.
- **Recommended additional control (future work):** Add a Cloudflare WAF rate-limiting rule at the 
  zone/CDN level before requests even reach the Worker. This is the true first line of defense and 
  is free on the Workers Free plan for basic rules.

---

## Monthly Cost Ceiling Summary

| Scenario | Estimated monthly cost |
|---|---|
| Zero traffic | $0 |
| 10K real users, 100 PV/day each | ~$0 (within free tiers) |
| Sustained 1M req/day adversarial attack | ~$42/month |
| Sustained 10M req/day (10 isolates) | ~$420/month worst case |

**Verdict:** BEAM-150 controls reduce the worst-case cost from $14,400/day to approximately $42/month 
for a single-isolate scenario. The remaining residual risk is acceptable for a bootstrapped product and 
can be further mitigated with Cloudflare WAF rules.

---

## Recommended Future Hardening

1. **Cloudflare WAF rate limiting** — Add a zone-level rule to rate-limit `/api/collect` by IP before 
   the Worker runs. Free tier includes basic rules. This eliminates Worker invocation costs for attackers.
2. **Durable Object counter for global cap** — Replace the per-isolate in-memory counter with a single 
   Durable Object for a truly global daily cap. Durable Object writes are $12.50/million but writes are 
   rare (only 1 per 1000 requests with batching).
3. **site_id allowlist in KV** — Cache valid site IDs in KV with a 1-hour TTL so the D1 site-lookup 
   query can be skipped for repeat attacks on known site IDs.
