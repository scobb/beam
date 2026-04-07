export interface Env {
  DB: D1Database
  KV: KVNamespace
  BEAM_JWT_SECRET?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_LAUNCH_PROMOTION_CODE_ID?: string
  RESEND_API_KEY?: string
  ENVIRONMENT?: string
  GOOGLE_SITE_VERIFICATION?: string
  BEAM_SELF_SITE_ID?: string
  PUBLIC_BASE_URL?: string
  INDEXNOW_KEY?: string
  SENTRY_DSN?: string
  NEXUS_API_KEY?: string
}

export type AuthUser = {
  sub: string
  email: string
  plan: string
  exp: number
}
