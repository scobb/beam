const INTERNAL_TEST_DOMAINS = [
  'keylightdigital.dev',
  'keylightdigital.com',
  'example.com',
  'testmail.dev',
]

function parseEmailParts(email: string): { localPart: string; domain: string } | null {
  const normalized = email.trim().toLowerCase()
  const atIndex = normalized.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === normalized.length - 1) return null

  return {
    localPart: normalized.slice(0, atIndex),
    domain: normalized.slice(atIndex + 1),
  }
}

export function isVerificationAliasLocalPart(localPart: string): boolean {
  const normalized = localPart.trim().toLowerCase()
  if (!normalized) return false

  return (
    /^ralph\+[a-z0-9._-]+$/.test(normalized) ||
    /^phase(?:[0-9]|[-_+])[a-z0-9._+-]*$/.test(normalized)
  )
}

function isInternalTestDomain(domain: string): boolean {
  return INTERNAL_TEST_DOMAINS.some((allowedDomain) => (
    domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
  ))
}

export function isInternalOrTestEmail(email: string): boolean {
  const parts = parseEmailParts(email)
  if (!parts) return false

  return isInternalTestDomain(parts.domain) || isVerificationAliasLocalPart(parts.localPart)
}

export function buildInternalOrTestEmailSql(emailColumn: string): string {
  const normalizedEmail = `LOWER(TRIM(${emailColumn}))`
  const atPos = `INSTR(${normalizedEmail}, '@')`
  const localPart = `CASE WHEN ${atPos} > 1 THEN SUBSTR(${normalizedEmail}, 1, ${atPos} - 1) ELSE '' END`
  const domain = `CASE WHEN ${atPos} > 1 THEN SUBSTR(${normalizedEmail}, ${atPos} + 1) ELSE '' END`

  return `(
    ${domain} = 'keylightdigital.dev'
    OR ${domain} = 'keylightdigital.com'
    OR ${domain} = 'example.com'
    OR ${domain} = 'testmail.dev'
    OR ${domain} LIKE '%.keylightdigital.dev'
    OR ${domain} LIKE '%.keylightdigital.com'
    OR ${domain} LIKE '%.example.com'
    OR ${domain} LIKE '%.testmail.dev'
    OR ${localPart} GLOB 'ralph+*'
    OR ${localPart} GLOB 'phase[0-9]*'
    OR ${localPart} GLOB 'phase-*'
    OR ${localPart} GLOB 'phase_*'
    OR ${localPart} GLOB 'phase+*'
  )`
}
