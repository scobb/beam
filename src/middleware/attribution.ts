import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import {
  buildFirstTouchAttribution,
  FIRST_TOUCH_COOKIE,
  FIRST_TOUCH_MAX_AGE_SECONDS,
  parseFirstTouchCookie,
  serializeFirstTouchCookie,
} from '../lib/attribution'
import type { Env } from '../types'

const STATIC_PATH_RE = /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$/i

function shouldCaptureForPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/dashboard')) return false
  if (pathname.startsWith('/js/')) return false
  if (STATIC_PATH_RE.test(pathname)) return false
  return true
}

export const firstTouchAttributionMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.req.method !== 'GET') return next()

  const accept = (c.req.header('accept') ?? '').toLowerCase()
  if (!accept.includes('text/html')) return next()

  const url = new URL(c.req.url)
  if (!shouldCaptureForPath(url.pathname)) return next()

  const existing = parseFirstTouchCookie(getCookie(c, FIRST_TOUCH_COOKIE))
  if (existing) return next()

  const firstTouch = buildFirstTouchAttribution(url, c.req.header('referer'))
  await next()

  setCookie(c, FIRST_TOUCH_COOKIE, serializeFirstTouchCookie(firstTouch), {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    maxAge: FIRST_TOUCH_MAX_AGE_SECONDS,
    path: '/',
  })
})
