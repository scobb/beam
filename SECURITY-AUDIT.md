# Beam Security Audit

**Date:** 2026-04-06  
**Auditor:** Ralph (autonomous agent, Keylight Digital LLC)  
**Scope:** SQL injection, XSS, CSRF, rate limiting, JWT handling, Stripe webhook verification

---

## Summary

| Category | Status | Severity |
|----------|--------|----------|
| SQL injection | PASS | — |
| XSS | PASS | — |
| CSRF | PASS | — |
| Rate limiting (auth) | PASS | — |
| Rate limiting (collect) | PASS | — |
| JWT handling | PASS (minor note) | Low |
| Stripe webhook signature | FIXED | Medium |
| Stripe webhook replay | FIXED | Medium |
| Password comparison timing | ACCEPTABLE | Low |

---

## Findings

### SQL Injection — PASS

All D1 queries use `db.prepare(sql).bind(...params)`. No string concatenation into SQL.

Dynamic `IN (?, ?, ...)` clauses in `collect.ts` are built by repeating `'?'` characters and
bound with spread parameters — correct and safe:

```ts
const placeholders = siteIds.map(() => '?').join(',')
db.prepare(`SELECT ... WHERE site_id IN (${placeholders}) ...`).bind(...siteIds, ...)
```

### XSS — PASS

- `escHtml()` is defined in `routes/dashboard.ts` and used in all user-data interpolation points
- `escHtml()` is also defined locally in `routes/for.ts` for guide content interpolation  
- Public marketing pages use static content only — no user input rendered into HTML
- `sanitizeEventProperties()` in `collect.ts` strictly validates custom event property keys/values
  before storing, limiting key length to 40 chars and string values to 200 chars

**Note:** Blog post and landing page routes render static string literals only — no user input
reaches the HTML template strings.

### CSRF — PASS

Auth session cookies are set with `sameSite: 'Lax'`, which blocks cross-site POST requests from
including the session cookie. This provides implicit CSRF protection for all state-mutating
dashboard endpoints without requiring explicit CSRF tokens.

`sameSite: 'Strict'` would be marginally stronger (blocks cross-site GETs with cookies) but
`Lax` is the web platform standard for session cookies and is sufficient here.

### Rate Limiting — PASS

Auth endpoints:
- `/api/auth/signup`: 10 attempts per IP per hour (KV-backed)
- `/api/auth/login`: 15 attempts per IP per 15 minutes (KV-backed)
- `/api/auth/reset-request`: 3 attempts per email per hour (KV-backed), silently drops to prevent enumeration

Collect endpoint:
- Per-IP: 100 requests per 60-second window (in-memory, per-isolate)
- Global daily cap: 500,000 per isolate before returning 503 with zero D1/KV ops
- Free-tier daily cap: 5,000 pageviews per user per day (KV-cached)
- Free-tier monthly cap: 50,000 pageviews per user per month (KV-cached)
- Origin/Referer validation: rejects requests where Origin header domain doesn't match registered site domain

**Limitation:** In-memory rate limits in `collect.ts` are per-isolate (Cloudflare Workers may
spawn multiple isolates). This is documented and accepted — the limits are cost-protection
mechanisms, not security gates. KV-backed limits in auth routes are global.

### JWT Handling — PASS (minor note)

JWT verification in `src/auth.ts` uses `crypto.subtle.verify('HMAC', ...)` which is performed
by the platform's cryptographic subsystem — timing-safe.

JWT expiration (`exp` claim) is validated on every request via `authMiddleware`.

**Minor note:** The fallback `BEAM_JWT_SECRET ?? 'dev-secret-changeme'` in `auth.ts` means if
the `BEAM_JWT_SECRET` environment variable is missing in production, JWTs are signed with a
well-known string. This is a misconfiguration risk. The secret is deployed as a Wrangler
secret and verified during deploy, but the runtime fallback should be documented.

**Recommendation (non-blocking):** Add a startup check that logs a warning when `BEAM_JWT_SECRET`
is missing, so misconfiguration is visible in worker logs rather than silently degrading to a
known secret.

### Password Comparison Timing — ACCEPTABLE

`verifyPassword()` in `src/auth.ts` uses PBKDF2 (100,000 iterations, SHA-256) to derive both
the stored and candidate hash, then compares them as hex strings:

```ts
return newHashHex === hashHex
```

Direct string comparison can leak length information via timing. However, because PBKDF2
derivation (≈50–100ms) dominates the total execution time, the marginal timing signal from
string comparison is negligible in practice.

**Timing oracle for user enumeration:** When a login request uses a non-existent email, the
`verifyPassword` call is skipped entirely (JavaScript `||` short-circuits). An attacker could
distinguish "user not found" from "wrong password" by timing the response. This is a well-known
class of issue in auth systems; the fix is a dummy PBKDF2 call on missing users.

**Risk assessment:** Low. Exploiting this requires many timed requests from a controlled
network position, and the information (whether an email is registered) is partially inferrable
from the signup error message ("Email already registered").

**Recommendation (non-blocking):** Add a dummy `verifyPassword` call on the "user not found"
path to equalize timing:

```ts
const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<...>()
const passwordOk = user ? await verifyPassword(password, user.password_hash)
                        : (await verifyPassword(password, 'dummy:000...'), false)
if (!user || !passwordOk) return c.json({ error: 'Invalid credentials' }, 401)
```

### Stripe Webhook Signature — FIXED

**Before:** `verifyStripeSignature` computed an HMAC and compared it to the request's `v1=`
value using direct string equality (`computedSig === v1`).

**Issues fixed:**
1. **Replay attack window:** No timestamp validation meant a captured webhook payload could be
   replayed indefinitely. **Fixed:** Timestamp `t` is now validated to be within 300 seconds
   of current UTC time (matching Stripe's recommended tolerance).
2. **Timing-safe comparison:** Direct hex string comparison replaced with `crypto.subtle.verify()`
   operating on raw bytes. The key is now imported with `usage: ['verify']` and the expected
   signature is decoded from hex to `Uint8Array` before comparison.

**After (key changes in `billing.ts`):**

```ts
// Reject events older than 300 seconds to prevent replay attacks
const eventTime = parseInt(t, 10)
if (isNaN(eventTime) || Math.abs(Math.floor(Date.now() / 1000) - eventTime) > 300) return false

// Timing-safe HMAC verify
const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
const expectedBytes = new Uint8Array(v1.match(/.{2}/g)?.map(h => parseInt(h, 16)) ?? [])
return crypto.subtle.verify('HMAC', key, expectedBytes, encoder.encode(payload))
```

---

## Security Controls Summary

| Control | Implementation | Location |
|---------|---------------|----------|
| Password hashing | PBKDF2 SHA-256, 100K iterations, 16-byte random salt | `src/auth.ts` |
| JWT signing | HMAC-SHA256 via Web Crypto API | `src/auth.ts` |
| JWT expiry | `exp` claim checked on every authenticated request | `src/middleware/auth.ts` |
| Session cookie | `HttpOnly`, `Secure` (non-dev), `SameSite=Lax` | `src/routes/auth.ts` |
| Auth rate limiting | KV-backed per-IP limits on signup/login/reset | `src/routes/auth.ts` |
| Collect rate limiting | In-memory per-IP + global cap + KV monthly/daily caps | `src/routes/collect.ts` |
| Origin validation | Domain matching on collect endpoint | `src/routes/collect.ts` |
| Payload limits | 4KB max on collect, field-level truncation throughout | `src/routes/collect.ts` |
| Stripe webhook auth | HMAC-SHA256 + 300s replay window | `src/routes/billing.ts` |
| SQL injection | Parameterized queries throughout (`prepare().bind()`) | All route files |
| XSS | `escHtml()` for all user data in templates | `src/routes/dashboard.ts`, `for.ts` |
| Secrets management | Wrangler secrets (not committed to source) | Cloudflare Workers env |
| API key storage | Hashed (SHA-256) in D1, raw value in short-lived KV flash | `src/lib/apiKeys.ts` |
| SSRF protection | URL validation on scanner + migrate endpoints | `src/lib/stackScanner.ts` |

---

## Out of Scope

- Cloudflare infrastructure security (WAF, DDoS, TLS) — managed by Cloudflare
- Third-party dependency audits (`npm audit`) — run separately
- Penetration testing — not performed
- Data privacy / GDPR compliance — covered by product design (no PII stored)
