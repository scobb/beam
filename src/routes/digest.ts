import { Hono } from 'hono'
import type { Env } from '../types'

const digest = new Hono<{ Bindings: Env }>()

// ── HMAC helpers for signed unsubscribe tokens ────────────────────────────────

async function signUnsubscribe(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const msg = `unsubscribe:${userId}`
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  // token = base64url(userId + ':' + sigHex)
  const raw = `${userId}:${sigHex}`
  let str = ''
  for (let i = 0; i < raw.length; i++) str += String.fromCharCode(raw.charCodeAt(i))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function verifyUnsubscribe(token: string, secret: string): Promise<string | null> {
  try {
    const padded = token + '='.repeat((4 - (token.length % 4)) % 4)
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const colonIdx = raw.indexOf(':')
    if (colonIdx === -1) return null
    const userId = raw.slice(0, colonIdx)
    const givenSig = raw.slice(colonIdx + 1)

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const msg = `unsubscribe:${userId}`
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (givenSig !== expectedSig) return null
    return userId
  } catch {
    return null
  }
}

export { signUnsubscribe }

// ── Unsubscribe route ─────────────────────────────────────────────────────────

digest.get('/api/digest/unsubscribe', async (c) => {
  const token = c.req.query('token') ?? ''
  const secret = c.env.BEAM_JWT_SECRET ?? 'dev-secret-changeme'

  const userId = await verifyUnsubscribe(token, secret)
  if (!userId) {
    return c.html(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Invalid Link — Beam</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
<div class="text-center p-8">
  <h1 class="text-2xl font-bold text-gray-900 mb-2">Invalid unsubscribe link</h1>
  <p class="text-gray-600">This link is invalid or has expired.</p>
  <a href="/" class="mt-4 inline-block text-indigo-600 hover:underline">Go to Beam</a>
</div></body></html>`, 400)
  }

  await c.env.DB.prepare(
    'UPDATE users SET digest_opt_out = 1, updated_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), userId).run()

  return c.html(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Unsubscribed — Beam</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
<div class="text-center p-8">
  <div class="text-4xl mb-4">✓</div>
  <h1 class="text-2xl font-bold text-gray-900 mb-2">You've been unsubscribed</h1>
  <p class="text-gray-600 mb-4">You won't receive weekly digest emails from Beam anymore.</p>
  <a href="/login" class="text-indigo-600 hover:underline">Log in to re-enable digests in settings</a>
</div></body></html>`)
})

export { digest }
