// PBKDF2 password hashing using Web Crypto API

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )

  const hashBytes = new Uint8Array(derivedBits)
  const saltHex = toHex(salt)
  const hashHex = toHex(hashBytes)
  return `${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  const saltHex = parts[0] ?? ''
  const hashHex = parts[1] ?? ''
  const encoder = new TextEncoder()
  const salt = fromHex(saltHex)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )

  const newHashHex = toHex(new Uint8Array(derivedBits))
  return newHashHex === hashHex
}

// JWT (HS256) using Web Crypto API

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? []
  return new Uint8Array(matches.map(h => parseInt(h, 16)))
}

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function getHmacKey(secret: string, usage: ('sign' | 'verify')[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  )
}

export async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  const message = `${header}.${body}`

  const key = await getHmacKey(secret, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return `${message}.${base64url(signature)}`
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const header = parts[0] ?? ''
  const payload = parts[1] ?? ''
  const sig = parts[2] ?? ''
  const message = `${header}.${payload}`

  const key = await getHmacKey(secret, ['verify'])
  const sigBytes = base64urlDecode(sig)
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(message))
  if (!valid) return null

  const decoded = JSON.parse(new TextDecoder().decode(base64urlDecode(payload))) as Record<string, unknown>
  if (typeof decoded.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) return null

  return decoded
}
