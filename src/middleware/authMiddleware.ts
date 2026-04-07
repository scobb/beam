import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { setUser } from '@sentry/cloudflare'
import { verifyJWT } from '../auth'
import type { Env, AuthUser } from '../types'

export const authMiddleware = createMiddleware<{
  Bindings: Env
  Variables: { user: AuthUser }
}>(async (c, next) => {
  const token = getCookie(c, 'beam_session')
  if (!token) return c.redirect('/login')

  const secret = c.env.BEAM_JWT_SECRET ?? 'dev-secret-changeme'
  const payload = await verifyJWT(token, secret)

  if (!payload) return c.redirect('/login')

  const authUser = payload as unknown as AuthUser
  c.set('user', authUser)
  // Tag Sentry errors with user ID (not email) for authenticated routes
  setUser({ id: authUser.sub })
  await next()
})
