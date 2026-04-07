# Beam Security Audit Report
**Date:** 2026-04-04  
**Auditor:** Ralph (autonomous agent)  
**Scope:** All route handlers, middleware, auth logic, and input paths in `beam/src/`

---

## Audit Methodology

- Read every route file and middleware
- Checked for OWASP Top 10 categories
- Verified parameterized query usage for SQL injection
- Checked HTML output escaping for XSS
- Audited JWT implementation for algorithm pinning and expiry
- Audited PBKDF2 parameters for password hashing
- Checked cookie attributes
- Checked CORS policy
- Checked rate limiting on sensitive endpoints
- Checked input sanitization and length bounding
- Checked Stripe webhook signature verification

---

## Findings

### HIGH

#### H1 — No rate limiting on `/api/auth/login` (brute force)
- **File:** `beam/src/routes/auth.ts`, `auth.post('/api/auth/login', ...)`
- **Description:** The login endpoint has no IP-based or account-based rate limiting. An attacker can attempt unlimited password guesses against any email address without throttling or lockout.
- **Impact:** Credential brute-forcing against any account.
- **Fix:** Add KV-based rate limiting (e.g., 10 attempts per IP per 15 minutes, returning 429).
- **Status:** FIXED in this commit.

#### H2 — Stripe webhook fail-open when `STRIPE_WEBHOOK_SECRET` is not configured
- **File:** `beam/src/routes/billing.ts`, `billing.post('/api/webhooks/stripe', ...)`
- **Description:** The webhook handler checks `if (webhookSecret)` before verifying the Stripe signature. If `STRIPE_WEBHOOK_SECRET` is unset, the handler processes all incoming events without any authentication. An attacker who discovers the webhook URL can forge `checkout.session.completed` events to grant themselves Pro status for free.
- **Impact:** Unauthorized plan upgrade to Pro for any user ID.
- **Fix:** Reject with 500 if `STRIPE_WEBHOOK_SECRET` is not configured, rather than silently accepting.
- **Status:** FIXED in this commit.

---

### MEDIUM

#### M1 — No server-side minimum password length on signup
- **File:** `beam/src/routes/auth.ts`, `auth.post('/api/auth/signup', ...)`
- **Description:** The server only checks `!password` (empty string). The 8-character minimum shown in the HTML form uses `minlength="8"` which is a client-side constraint easily bypassed with a direct API call.
- **Impact:** Weak passwords (e.g., 1 character) can be registered, increasing account takeover risk.
- **Fix:** Add `if (password.length < 8)` check server-side.
- **Status:** FIXED in this commit.

#### M2 — No rate limiting on `/api/auth/signup` (email spam)
- **File:** `beam/src/routes/auth.ts`, `auth.post('/api/auth/signup', ...)`
- **Description:** An attacker can create thousands of accounts in rapid succession. Each signup triggers a welcome email (Resend API cost) and an admin notification email. Beyond email abuse, mass-created accounts consume D1 storage and inflate user count metrics.
- **Impact:** Email cost abuse, metric inflation.
- **Fix:** Add IP-based rate limiting (e.g., 5 signups per IP per hour).
- **Status:** FIXED in this commit.

#### M3 — `path` and `referrer` fields in `/api/collect` not length-bounded
- **File:** `beam/src/routes/collect.ts`, `app.post('/api/collect', ...)`
- **Description:** The `path` and `referrer` fields from pageview payloads are inserted into D1 without any length check. A malicious script embedding could send paths of arbitrary length (e.g., 1MB strings), consuming D1 storage.
- **Impact:** Storage abuse by authenticated site owners or script-level attackers.
- **Fix:** Truncate `path` to 2048 chars and `referrer` to 2048 chars before insertion.
- **Status:** FIXED in this commit.

#### M4 — No email format validation on signup
- **File:** `beam/src/routes/auth.ts`, `auth.post('/api/auth/signup', ...)`
- **Description:** Any non-empty string is accepted as an email address. This causes welcome emails to be sent to invalid addresses (bounces) and admin notifications with garbage email values.
- **Impact:** Email bounce abuse, confusing admin notifications.
- **Fix:** Add a basic regex check for `@` and `.` presence.
- **Status:** FIXED in this commit.

---

### LOW

#### L1 — Timing-unsafe comparison in `verifyPassword`
- **File:** `beam/src/auth.ts`, `verifyPassword()`
- **Description:** Uses `newHashHex === hashHex` (JavaScript `===`) for PBKDF2 hash comparison. This is not constant-time. In theory, a timing side-channel could be used to extract hash bytes one at a time.
- **Impact:** Extremely low practical risk — Cloudflare Workers' multi-tenant environment and network jitter make timing attacks impractical, and PBKDF2 with unique salts means a per-user timing oracle provides minimal advantage.
- **Recommendation:** Replace with a constant-time comparison using `crypto.subtle.timingSafeEqual` if/when Workers supports it, or compare at the HMAC level. Not fixed in this audit due to low practical risk and no Workers native constant-time comparison.

#### L2 — Timing-unsafe comparison in `verifyStripeSignature`
- **File:** `beam/src/routes/billing.ts`, `verifyStripeSignature()`
- **Description:** Uses `computedSig === v1` for HMAC-SHA256 comparison instead of a constant-time function. An attacker controlling many webhook requests could theoretically detect timing differences to forge signatures.
- **Impact:** Near-zero practical risk. Stripe rotates secrets frequently and the attack would require millions of precisely-timed requests from within network proximity.
- **Recommendation:** Same as L1 — replace when `crypto.subtle.timingSafeEqual` is available in Workers.

#### L3 — JWT header `alg` field not validated
- **File:** `beam/src/auth.ts`, `verifyJWT()`
- **Description:** `verifyJWT` does not validate the `alg` field in the decoded header. However, since Web Crypto API always uses `HMAC` for verification (hardcoded), the classic `alg=none` bypass does not work — the signature verification will fail for any token not signed with HMAC-SHA256.
- **Impact:** None in current implementation.

#### L4 — `escHtml` does not escape single quotes
- **File:** `beam/src/routes/dashboard.ts`, `escHtml()`
- **Description:** The helper escapes `&`, `<`, `>`, and `"` but not `'`. In double-quoted HTML attribute contexts (which is the only usage pattern) this is safe, but it is incomplete.
- **Impact:** None currently, as all HTML attributes use double quotes consistently.

#### L5 — CORS wildcard on `/api/collect`
- **File:** `beam/src/routes/collect.ts`
- **Description:** `Access-Control-Allow-Origin: *` is intentional — the collect endpoint must accept cross-origin POSTs from any site. No sensitive headers are exposed. Noted for completeness.
- **Impact:** None (by design).

---

## Summary

| ID | Severity | Area | Status |
|----|----------|------|--------|
| H1 | HIGH | Login brute force | FIXED |
| H2 | HIGH | Stripe webhook fail-open | FIXED |
| M1 | MEDIUM | Password length (server) | FIXED |
| M2 | MEDIUM | Signup rate limiting | FIXED |
| M3 | MEDIUM | Collect field length | FIXED |
| M4 | MEDIUM | Email format validation | FIXED |
| L1 | LOW | Timing-unsafe password compare | Deferred |
| L2 | LOW | Timing-unsafe Stripe sig compare | Deferred |
| L3 | LOW | JWT alg not validated | No exploit |
| L4 | LOW | escHtml missing `'` | No impact |
| L5 | LOW | CORS wildcard on collect | Intentional |

All CRITICAL (none found) and HIGH findings have been fixed.
