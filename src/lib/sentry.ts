import type { ErrorEvent } from '@sentry/cloudflare'

/**
 * Strips PII from Sentry events before they are sent.
 *
 * - Removes Authorization and Cookie header values
 * - Removes user email (only user.id is kept)
 * - Removes IP addresses
 */
export function scrubEventPII(event: ErrorEvent): ErrorEvent | null {
  // Strip sensitive request headers
  if (event.request?.headers) {
    const headers = { ...event.request.headers }
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase()
      if (lower === 'authorization' || lower === 'cookie' || lower === 'set-cookie') {
        headers[key] = '[Filtered]'
      }
    }
    event.request = { ...event.request, headers }
  }

  // Remove cookies entirely
  if (event.request?.cookies) {
    event.request = { ...event.request, cookies: {} }
  }

  // Remove IP address from request
  if (event.request) {
    const req = event.request as Record<string, unknown>
    if (req['env'] && typeof req['env'] === 'object') {
      const env = req['env'] as Record<string, unknown>
      if ('REMOTE_ADDR' in env) {
        delete env['REMOTE_ADDR']
      }
    }
  }

  // Strip email from user context — keep only id
  if (event.user) {
    event.user = { id: event.user.id }
  }

  // Remove IP from user context
  if (event.user?.ip_address) {
    event.user = { ...event.user, ip_address: undefined }
  }

  return event
}
