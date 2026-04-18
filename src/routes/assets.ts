import { Hono } from 'hono'
import { TAILWIND_CSS } from '../tailwindCss'
import type { Env } from '../types'

export const assets = new Hono<{ Bindings: Env }>()

assets.get('/assets/tailwind.css', (c) => {
  return c.text(TAILWIND_CSS, 200, {
    'Content-Type': 'text/css; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
})
