import type { Env } from '../types'

export const DEFAULT_PUBLIC_BASE_URL = 'https://beam-privacy.com'

function normalizePublicBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_PUBLIC_BASE_URL

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, '')

  try {
    return new URL(withoutTrailingSlash).origin
  } catch {
    return DEFAULT_PUBLIC_BASE_URL
  }
}

export function getPublicBaseUrl(env?: Pick<Env, 'PUBLIC_BASE_URL'> | null): string {
  return normalizePublicBaseUrl(env?.PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL)
}

export function publicUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

export function publicHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl.replace(/^https?:\/\//, '')
  }
}
