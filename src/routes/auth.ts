import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { hashPassword, verifyPassword, createJWT } from '../auth'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl, publicHost } from '../lib/publicUrl'
import { buildSignupAttributionColumns, FIRST_TOUCH_COOKIE } from '../lib/attribution'

const auth = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()
const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

// ── HTML pages ──────────────────────────────────────────────────────────────

auth.get('/signup', (c) => c.html(signupPage(c.env.BEAM_SELF_SITE_ID, getPublicBaseUrl(c.env))))
auth.get('/login', (c) => {
  const reset = c.req.query('reset')
  return c.html(loginPage(reset === '1', getPublicBaseUrl(c.env)))
})

// ── API endpoints ────────────────────────────────────────────────────────────

auth.post('/api/auth/signup', async (c) => {
  // Rate limit: 10 signups per IP per hour (skipped when IP is unknown or localhost — local dev only)
  const signupIp = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
  const signupIpIsLocal = signupIp === 'unknown' || signupIp === '127.0.0.1' || signupIp === '::1'
  if (!signupIpIsLocal) {
    const signupRlKey = `ratelimit:signup:${signupIp}`
    const signupRlRaw = await c.env.KV.get(signupRlKey)
    const signupRlCount = signupRlRaw ? parseInt(signupRlRaw, 10) : 0
    if (signupRlCount >= 10) {
      return c.json({ error: 'Too many signup attempts. Please try again later.' }, 429)
    }
    await c.env.KV.put(signupRlKey, String(signupRlCount + 1), { expirationTtl: 3600 })
  }

  let body: { email?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { email, password } = body
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  // Server-side email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email address' }, 400)
  }

  // Server-side password length
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  const attribution = buildSignupAttributionColumns(getCookie(c, FIRST_TOUCH_COOKIE), email)

  await c.env.DB.prepare(
    `INSERT INTO users (
      id, email, password_hash, plan, created_at, updated_at,
      first_touch_ref, first_touch_utm_source, first_touch_utm_medium, first_touch_utm_campaign, first_touch_offer_code,
      first_touch_referrer_host, first_touch_landing_path, first_touch_captured_at, first_touch_is_internal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userId,
    email,
    passwordHash,
    'free',
    now,
    now,
    attribution.firstTouchRef,
    attribution.firstTouchUtmSource,
    attribution.firstTouchUtmMedium,
    attribution.firstTouchUtmCampaign,
    attribution.firstTouchOfferCode,
    attribution.firstTouchReferrerHost,
    attribution.firstTouchLandingPath,
    attribution.firstTouchCapturedAt,
    attribution.firstTouchIsInternal
  ).run()

  const token = await createJWT(
    { sub: userId, email, plan: 'free', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    c.env.BEAM_JWT_SECRET ?? 'dev-secret-changeme'
  )

  setCookie(c, 'beam_session', token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    maxAge: 7 * 24 * 3600,
    path: '/',
  })

  // Fire-and-forget welcome email
  const resendKey = c.env.RESEND_API_KEY
  if (resendKey) {
    const baseUrl = getPublicBaseUrl(c.env)
    const baseHost = publicHost(baseUrl)
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Beam <beam@keylightdigital.dev>',
        to: email,
        subject: 'Welcome to Beam — here\'s how to get started',
        text: `Welcome to Beam!\n\nThanks for signing up. Here's how to get your analytics up and running in minutes:\n\n1. Open setup\n   Go to ${baseUrl}/dashboard/setup for the guided first-site flow.\n\n2. Add your site + copy snippet\n   Enter your domain and copy the one-line script tag into your site's <head> section.\n\n3. Verify your first hit\n   Use the install verifier in setup, then open your dashboard to see pageviews.\n\nThat's it — no cookies, no GDPR headaches, no bloat.\n\nIf you have any questions, just reply to this email.\n\n— The Beam team\n${baseHost}`,
      }),
    }).catch(() => {}) // don't block signup on email failure

    // Fire-and-forget admin notification
    ;(async () => {
      try {
        const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>()
        const totalUsers = countResult?.count ?? 1
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Beam <beam@keylightdigital.dev>',
            to: 'steve@keylightdigital.dev',
            subject: `New Beam signup: ${email}`,
            text: `New signup on Beam!\n\nUser: ${email}\nTimestamp: ${now}\nTotal users: ${totalUsers}\n\n— Beam`,
          }),
        })
      } catch {
        // don't block signup on email failure
      }
    })()
  }

  return c.json({ token })
})

auth.post('/api/auth/login', async (c) => {
  // Rate limit: 15 attempts per IP per 15 minutes (skipped when IP is unknown — local dev only)
  const loginIp = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
  if (loginIp !== 'unknown') {
    const loginRlKey = `ratelimit:login:${loginIp}`
    const loginRlRaw = await c.env.KV.get(loginRlKey)
    const loginRlCount = loginRlRaw ? parseInt(loginRlRaw, 10) : 0
    if (loginRlCount >= 15) {
      return c.json({ error: 'Too many login attempts. Please try again in 15 minutes.' }, 429)
    }
    await c.env.KV.put(loginRlKey, String(loginRlCount + 1), { expirationTtl: 900 })
  }

  let body: { email?: string; password?: string; remember?: boolean }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { email, password, remember } = body
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<{
    id: string; email: string; password_hash: string; plan: string
  }>()

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const sessionTtl = remember ? 30 * 24 * 3600 : 7 * 24 * 3600

  const token = await createJWT(
    { sub: user.id, email: user.email, plan: user.plan, exp: Math.floor(Date.now() / 1000) + sessionTtl },
    c.env.BEAM_JWT_SECRET ?? 'dev-secret-changeme'
  )

  setCookie(c, 'beam_session', token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    maxAge: sessionTtl,
    path: '/',
  })

  return c.json({ token })
})

auth.get('/api/auth/logout', (c) => {
  deleteCookie(c, 'beam_session', { path: '/' })
  return c.redirect('/')
})

// ── Password reset ────────────────────────────────────────────────────────────

auth.get('/forgot-password', (c) => c.html(forgotPasswordPage()))

auth.get('/reset-password', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!token) return c.html(resetPasswordPage('', 'Missing or invalid reset token.'))
  const userId = await c.env.KV.get(`reset:${token}`)
  if (!userId) return c.html(resetPasswordPage('', 'This reset link has expired or is invalid.'))
  return c.html(resetPasswordPage(token, ''))
})

auth.post('/api/auth/reset-request', async (c) => {
  let body: { email?: string }
  try { body = await c.req.json() } catch { return c.json({ ok: true }) }
  const email = body.email?.trim().toLowerCase() ?? ''
  if (!email) return c.json({ ok: true })

  // Rate limit: max 3 reset requests per email per hour
  const rlKey = `ratelimit:reset:${email}`
  const rlRaw = await c.env.KV.get(rlKey)
  const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0
  if (rlCount >= 3) return c.json({ ok: true }) // silently drop — no enumeration
  await c.env.KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 })

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>()
  if (!user) return c.json({ ok: true }) // no enumeration

  const token = crypto.randomUUID()
  await c.env.KV.put(`reset:${token}`, user.id, { expirationTtl: 3600 })

  const baseUrl = getPublicBaseUrl(c.env)
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  const apiKey = c.env.RESEND_API_KEY
  if (apiKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Beam <beam@keylightdigital.dev>',
        to: email,
        subject: 'Reset your Beam password',
        text: `You requested a password reset for your Beam account.\n\nClick the link below to reset your password (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password won't change.\n\n— The Beam team`,
      }),
    }).catch(() => {}) // fire-and-forget
  }

  return c.json({ ok: true })
})

auth.post('/api/auth/reset-password', async (c) => {
  let body: { token?: string; password?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid request' }, 400) }
  const { token, password } = body
  if (!token || !password) return c.json({ error: 'Token and password are required' }, 400)
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  const userId = await c.env.KV.get(`reset:${token}`)
  if (!userId) return c.json({ error: 'Reset link has expired or is invalid' }, 400)

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(passwordHash, now, userId).run()

  await c.env.KV.delete(`reset:${token}`)

  return c.json({ ok: true })
})

// ── Page templates ───────────────────────────────────────────────────────────

function signupPage(selfSiteId: string | undefined, baseUrl: string): string {
  const BEAM_SITE_ID = selfSiteId ?? BEAM_SITE_ID_FALLBACK
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up — Beam</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/signup" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center px-4">
  <div class="bg-white rounded-xl shadow p-6 sm:p-8 w-full max-w-md">
    <div class="text-center mb-6">
      <a href="/" class="text-2xl font-bold text-indigo-600">Beam</a>
      <p class="text-gray-500 mt-1">Create your account</p>
    </div>
    <form id="signup-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" name="email" required autocomplete="email"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input type="password" name="password" required minlength="8" autocomplete="new-password"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div id="error-msg" class="hidden text-red-600 text-sm rounded-lg bg-red-50 p-3"></div>
      <button type="submit"
        class="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 transition">
        Create Account
      </button>
    </form>
    <p class="text-center text-sm text-gray-500 mt-4">
      Already have an account? <a href="/login" class="text-indigo-600 hover:underline">Log in</a>
    </p>
  </div>
  <script>
    function trackEventually(name, properties) {
      let sent = false;
      const attempt = function () {
        if (sent) return;
        if (!window.beam || typeof window.beam.track !== 'function') return;
        window.beam.track(name, properties);
        sent = true;
      };
      attempt();
      if (sent) return;
      setTimeout(attempt, 120);
      setTimeout(attempt, 350);
      setTimeout(attempt, 700);
    }

    trackEventually('signup_start', { page: 'signup', source: 'beam_marketing_site' });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errEl = document.getElementById('error-msg');
      errEl.classList.add('hidden');
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email: form.email.value, password: form.password.value })
        });
        if (res.ok) {
          trackEventually('signup_complete', { page: 'signup', plan: 'free' });
          const params = new URLSearchParams(window.location.search);
          const nextPath = '/dashboard/setup';
          const nextParams = new URLSearchParams();
          if (params.get('intent') === 'pro') nextParams.set('intent', 'pro');
          const offer = params.get('offer');
          if (offer && /^[a-z0-9][a-z0-9-]{1,39}$/i.test(offer)) nextParams.set('offer', offer);
          const nextUrl = nextParams.toString() ? nextPath + '?' + nextParams.toString() : nextPath;
          setTimeout(() => { window.location.href = nextUrl; }, 150);
          return;
        }
        const data = await res.json();
        errEl.textContent = data.error || 'Signup failed';
        errEl.classList.remove('hidden');
      } catch {
        errEl.textContent = 'An error occurred. Please try again.';
        errEl.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>`
}

function loginPage(showResetSuccess = false, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log In — Beam</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/login" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center px-4">
  <div class="bg-white rounded-xl shadow p-6 sm:p-8 w-full max-w-md">
    <div class="text-center mb-6">
      <a href="/" class="text-2xl font-bold text-indigo-600">Beam</a>
      <p class="text-gray-500 mt-1">Welcome back</p>
    </div>
    ${showResetSuccess ? '<div class="text-green-700 text-sm rounded-lg bg-green-50 p-3 mb-4">Password reset successfully. Please log in with your new password.</div>' : ''}
    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" name="email" required autocomplete="email"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input type="password" name="password" required autocomplete="current-password"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div class="flex items-center gap-2">
        <input type="checkbox" id="remember" name="remember"
          class="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
        <label for="remember" class="text-sm text-gray-600">Keep me logged in</label>
      </div>
      <div id="error-msg" class="hidden text-red-600 text-sm rounded-lg bg-red-50 p-3"></div>
      <button type="submit"
        class="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 transition">
        Log In
      </button>
    </form>
    <p class="text-center text-sm text-gray-500 mt-2">
      <a href="/forgot-password" class="text-indigo-600 hover:underline">Forgot password?</a>
    </p>
    <p class="text-center text-sm text-gray-500 mt-2">
      Don't have an account? <a href="/signup" class="text-indigo-600 hover:underline">Sign up free</a>
    </p>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errEl = document.getElementById('error-msg');
      errEl.classList.add('hidden');
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email: form.email.value, password: form.password.value, remember: form.remember.checked })
        });
        if (res.ok) {
          const params = new URLSearchParams(window.location.search);
          const nextPath = params.get('intent') === 'pro' ? '/dashboard/billing' : '/dashboard';
          const nextParams = new URLSearchParams();
          const offer = params.get('offer');
          if (offer && /^[a-z0-9][a-z0-9-]{1,39}$/i.test(offer)) nextParams.set('offer', offer);
          window.location.href = nextParams.toString() ? nextPath + '?' + nextParams.toString() : nextPath;
          return;
        }
        const data = await res.json();
        errEl.textContent = data.error || 'Login failed';
        errEl.classList.remove('hidden');
      } catch {
        errEl.textContent = 'An error occurred. Please try again.';
        errEl.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>`
}

function forgotPasswordPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password — Beam</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center px-4">
  <div class="bg-white rounded-xl shadow p-6 sm:p-8 w-full max-w-md">
    <div class="text-center mb-6">
      <a href="/" class="text-2xl font-bold text-indigo-600">Beam</a>
      <p class="text-gray-500 mt-1">Reset your password</p>
    </div>
    <form id="reset-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email address</label>
        <input type="email" name="email" required autocomplete="email"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div id="msg" class="hidden text-sm rounded-lg p-3"></div>
      <button type="submit"
        class="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 transition">
        Send Reset Link
      </button>
    </form>
    <p class="text-center text-sm text-gray-500 mt-4">
      <a href="/login" class="text-indigo-600 hover:underline">Back to login</a>
    </p>
  </div>
  <script>
    document.getElementById('reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msgEl = document.getElementById('msg');
      msgEl.className = 'hidden text-sm rounded-lg p-3';
      try {
        await fetch('/api/auth/reset-request', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email: form.email.value })
        });
        msgEl.textContent = 'If an account exists for that email, a reset link has been sent.';
        msgEl.className = 'text-green-700 text-sm rounded-lg bg-green-50 p-3';
        form.reset();
      } catch {
        msgEl.textContent = 'An error occurred. Please try again.';
        msgEl.className = 'text-red-600 text-sm rounded-lg bg-red-50 p-3';
      }
    });
  <\/script>
</body>
</html>`
}

function resetPasswordPage(token: string, errorMsg: string): string {
  const hasToken = token.length > 0 && !errorMsg
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — Beam</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center px-4">
  <div class="bg-white rounded-xl shadow p-6 sm:p-8 w-full max-w-md">
    <div class="text-center mb-6">
      <a href="/" class="text-2xl font-bold text-indigo-600">Beam</a>
      <p class="text-gray-500 mt-1">Choose a new password</p>
    </div>
    ${errorMsg ? `<div class="text-red-600 text-sm rounded-lg bg-red-50 p-3 mb-4">${errorMsg}</div>` : ''}
    ${hasToken ? `
    <form id="new-pw-form" class="space-y-4">
      <input type="hidden" name="token" value="${token}" />
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">New password</label>
        <input type="password" name="password" required minlength="8" autocomplete="new-password"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div id="error-msg" class="hidden text-red-600 text-sm rounded-lg bg-red-50 p-3"></div>
      <button type="submit"
        class="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 transition">
        Reset Password
      </button>
    </form>
    <script>
      document.getElementById('new-pw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errEl = document.getElementById('error-msg');
        errEl.classList.add('hidden');
        try {
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: form.token.value, password: form.password.value })
          });
          if (res.ok) { window.location.href = '/login?reset=1'; return; }
          const data = await res.json();
          errEl.textContent = data.error || 'Reset failed';
          errEl.classList.remove('hidden');
        } catch {
          errEl.textContent = 'An error occurred. Please try again.';
          errEl.classList.remove('hidden');
        }
      });
    <\/script>
    ` : ''}
    <p class="text-center text-sm text-gray-500 mt-4">
      <a href="/login" class="text-indigo-600 hover:underline">Back to login</a>
    </p>
  </div>
</body>
</html>`
}

export { auth }
