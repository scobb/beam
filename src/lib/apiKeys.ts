function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function createApiKey(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
  return toHex(new Uint8Array(digest))
}
