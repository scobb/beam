export const IMPORT_SOURCES = ['google_analytics', 'plausible', 'fathom'] as const
export type ImportSource = (typeof IMPORT_SOURCES)[number]

export const IMPORT_JOB_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number]

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

export interface ImportedDailyMetric {
  date: string
  visitors: number
  pageviews: number
}

export const GOOGLE_ANALYTICS_DAILY_REQUIRED_COLUMNS = ['Date', 'Active users', 'Views'] as const
export const PLAUSIBLE_DAILY_REQUIRED_COLUMNS = ['Date', 'Visitors', 'Pageviews'] as const
export const FATHOM_DAILY_REQUIRED_COLUMNS = ['Date', 'Unique visitors', 'Pageviews'] as const

export interface ParsedGoogleAnalyticsDailyCsv {
  source: 'google_analytics'
  rowCount: number
  coverageStartDate: string
  coverageEndDate: string
  rows: ImportedDailyMetric[]
}

export type ParseGoogleAnalyticsDailyCsvResult =
  | { ok: true; value: ParsedGoogleAnalyticsDailyCsv }
  | { ok: false; error: string }

export interface ParsedPlausibleDailyCsv {
  source: 'plausible'
  rowCount: number
  coverageStartDate: string
  coverageEndDate: string
  rows: ImportedDailyMetric[]
}

export type ParsePlausibleDailyCsvResult =
  | { ok: true; value: ParsedPlausibleDailyCsv }
  | { ok: false; error: string }

export interface ParsedFathomDailyCsv {
  source: 'fathom'
  rowCount: number
  coverageStartDate: string
  coverageEndDate: string
  rows: ImportedDailyMetric[]
}

export type ParseFathomDailyCsvResult =
  | { ok: true; value: ParsedFathomDailyCsv }
  | { ok: false; error: string }

export type ImportedDailyMetricParseResult =
  | { ok: true; value: ImportedDailyMetric }
  | { ok: false; error: string }

export interface NativeDailyMetricRow extends ImportedDailyMetric {}

export interface ImportedDailyMetricRow extends ImportedDailyMetric {
  source: ImportSource
  importedAt: string
}

export interface MergedDailyMetric extends ImportedDailyMetric {
  dataSource: 'native' | ImportSource
}

export interface ImportCoverageSnapshot {
  nativeStartDate: string | null
  nativeEndDate: string | null
  importedStartDate: string | null
  importedEndDate: string | null
}

export interface ImportCoverageWindow extends ImportCoverageSnapshot {
  mode: 'empty' | 'import-only' | 'native-only' | 'hybrid'
  cutoverDate: string | null
  importedVisibleStartDate: string | null
  importedVisibleEndDate: string | null
}

function isIsoDay(value: string): boolean {
  const match = ISO_DAY_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function normalizeIsoDay(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || !isIsoDay(trimmed)) return null
  return trimmed
}

function previousIsoDay(isoDay: string): string {
  const match = ISO_DAY_RE.exec(isoDay)
  if (!match) return isoDay
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day) - DAY_MS)
  return date.toISOString().slice(0, 10)
}

function parseNonNegativeInteger(
  value: string | number | undefined,
  field: string,
  rowLabel: string
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: false, error: `${rowLabel}: missing ${field}` }
  }

  const raw = typeof value === 'number' ? String(value) : value.trim()
  if (!raw) {
    return { ok: false, error: `${rowLabel}: missing ${field}` }
  }

  const normalized = raw.replace(/,/g, '')
  if (!/^-?\d+$/.test(normalized)) {
    return { ok: false, error: `${rowLabel}: invalid ${field}` }
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: `${rowLabel}: invalid ${field}` }
  }

  return { ok: true, value: parsed }
}

type CsvParseResult = { ok: true; rows: string[][] } | { ok: false; error: string }

function parseCsvRows(csvText: string): CsvParseResult {
  const normalizedText = csvText.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i]
    if (char === undefined) continue

    if (inQuotes) {
      if (char === '"') {
        const next = normalizedText[i + 1]
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (char === '\n' || char === '\r') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (char === '\r' && normalizedText[i + 1] === '\n') {
        i += 1
      }
      continue
    }

    field += char
  }

  if (inQuotes) {
    return { ok: false, error: 'CSV parse error: unmatched quote in file' }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  while (rows.length > 0 && rows[rows.length - 1]?.every((cell) => cell.trim() === '')) {
    rows.pop()
  }

  return { ok: true, rows }
}

function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeGoogleAnalyticsDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (isIsoDay(trimmed)) return trimmed

  if (!/^\d{8}$/.test(trimmed)) return null
  const normalized = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  return isIsoDay(normalized) ? normalized : null
}

function normalizePlausibleDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || !isIsoDay(trimmed)) return null
  return trimmed
}

function normalizeFathomDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || !isIsoDay(trimmed)) return null
  return trimmed
}

export function normalizeImportSource(raw: string | null | undefined): ImportSource | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toLowerCase()
  return IMPORT_SOURCES.find((source) => source === normalized) ?? null
}

export function normalizeImportJobStatus(raw: string | null | undefined): ImportJobStatus | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toLowerCase()
  return IMPORT_JOB_STATUSES.find((status) => status === normalized) ?? null
}

export function parseImportedDailyMetricRow(
  row: { date?: string; visitors?: string | number; pageviews?: string | number },
  rowNumber?: number
): ImportedDailyMetricParseResult {
  const rowLabel = rowNumber === undefined ? 'Row' : `Row ${rowNumber}`
  const date = normalizeIsoDay(row.date)
  if (!date) {
    return { ok: false, error: `${rowLabel}: invalid date (expected YYYY-MM-DD)` }
  }

  const visitors = parseNonNegativeInteger(row.visitors, 'visitors', rowLabel)
  if (!visitors.ok) return visitors

  const pageviews = parseNonNegativeInteger(row.pageviews, 'pageviews', rowLabel)
  if (!pageviews.ok) return pageviews

  return {
    ok: true,
    value: {
      date,
      visitors: visitors.value,
      pageviews: pageviews.value,
    },
  }
}

export function parseGoogleAnalyticsDailyCsv(csvText: string): ParseGoogleAnalyticsDailyCsvResult {
  const parsedCsv = parseCsvRows(csvText)
  if (!parsedCsv.ok) return parsedCsv

  const nonEmptyHeaderIndex = parsedCsv.rows.findIndex((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmptyHeaderIndex < 0) {
    return { ok: false, error: 'CSV is empty. Expected columns: Date, Active users, Views.' }
  }

  const headerRow = parsedCsv.rows[nonEmptyHeaderIndex] ?? []
  const headerIndexByName = new Map<string, number>()
  for (let i = 0; i < headerRow.length; i += 1) {
    const header = headerRow[i]
    if (header === undefined) continue
    headerIndexByName.set(normalizeCsvHeader(header), i)
  }

  const dateIndex = headerIndexByName.get('date')
  const activeUsersIndex = headerIndexByName.get('active users')
  const viewsIndex = headerIndexByName.get('views')
  const missingColumns = GOOGLE_ANALYTICS_DAILY_REQUIRED_COLUMNS.filter((column) => {
    const normalized = normalizeCsvHeader(column)
    return !headerIndexByName.has(normalized)
  })
  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `Unsupported GA CSV format. Missing required column(s): ${missingColumns.join(', ')}.`,
    }
  }

  const aggregatedByDate = new Map<string, ImportedDailyMetric>()
  let parsedRowCount = 0

  for (let rowIndex = nonEmptyHeaderIndex + 1; rowIndex < parsedCsv.rows.length; rowIndex += 1) {
    const csvRow = parsedCsv.rows[rowIndex] ?? []
    if (csvRow.every((cell) => cell.trim() === '')) continue
    parsedRowCount += 1
    const rowNumber = rowIndex + 1

    const normalizedDate = normalizeGoogleAnalyticsDate(csvRow[dateIndex ?? -1] ?? '')
    if (!normalizedDate) {
      return {
        ok: false,
        error: `Row ${rowNumber}: invalid date (expected YYYY-MM-DD or YYYYMMDD).`,
      }
    }

    const parsedMetric = parseImportedDailyMetricRow(
      {
        date: normalizedDate,
        visitors: csvRow[activeUsersIndex ?? -1],
        pageviews: csvRow[viewsIndex ?? -1],
      },
      rowNumber,
    )
    if (!parsedMetric.ok) {
      return parsedMetric
    }

    const current = aggregatedByDate.get(parsedMetric.value.date)
    if (!current) {
      aggregatedByDate.set(parsedMetric.value.date, parsedMetric.value)
      continue
    }

    current.visitors += parsedMetric.value.visitors
    current.pageviews += parsedMetric.value.pageviews
  }

  if (parsedRowCount === 0 || aggregatedByDate.size === 0) {
    return { ok: false, error: 'No daily rows found in CSV after the header row.' }
  }

  const rows = [...aggregatedByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const coverageStartDate = rows[0]?.date
  const coverageEndDate = rows[rows.length - 1]?.date
  if (!coverageStartDate || !coverageEndDate) {
    return { ok: false, error: 'Unable to determine import coverage window from CSV.' }
  }

  return {
    ok: true,
    value: {
      source: 'google_analytics',
      rowCount: parsedRowCount,
      coverageStartDate,
      coverageEndDate,
      rows,
    },
  }
}

export function parsePlausibleDailyCsv(csvText: string): ParsePlausibleDailyCsvResult {
  const parsedCsv = parseCsvRows(csvText)
  if (!parsedCsv.ok) return parsedCsv

  const nonEmptyHeaderIndex = parsedCsv.rows.findIndex((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmptyHeaderIndex < 0) {
    return { ok: false, error: 'CSV is empty. Expected columns: Date, Visitors, Pageviews.' }
  }

  const headerRow = parsedCsv.rows[nonEmptyHeaderIndex] ?? []
  const headerIndexByName = new Map<string, number>()
  for (let i = 0; i < headerRow.length; i += 1) {
    const header = headerRow[i]
    if (header === undefined) continue
    headerIndexByName.set(normalizeCsvHeader(header), i)
  }

  const dateIndex = headerIndexByName.get('date')
  const visitorsIndex = headerIndexByName.get('visitors')
  const pageviewsIndex = headerIndexByName.get('pageviews')
  const missingColumns = PLAUSIBLE_DAILY_REQUIRED_COLUMNS.filter((column) => {
    const normalized = normalizeCsvHeader(column)
    return !headerIndexByName.has(normalized)
  })
  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `Unsupported Plausible CSV format. Missing required column(s): ${missingColumns.join(', ')}.`,
    }
  }

  const aggregatedByDate = new Map<string, ImportedDailyMetric>()
  let parsedRowCount = 0

  for (let rowIndex = nonEmptyHeaderIndex + 1; rowIndex < parsedCsv.rows.length; rowIndex += 1) {
    const csvRow = parsedCsv.rows[rowIndex] ?? []
    if (csvRow.every((cell) => cell.trim() === '')) continue
    parsedRowCount += 1
    const rowNumber = rowIndex + 1

    const normalizedDate = normalizePlausibleDate(csvRow[dateIndex ?? -1] ?? '')
    if (!normalizedDate) {
      return {
        ok: false,
        error: `Row ${rowNumber}: invalid date (expected YYYY-MM-DD).`,
      }
    }

    const parsedMetric = parseImportedDailyMetricRow(
      {
        date: normalizedDate,
        visitors: csvRow[visitorsIndex ?? -1],
        pageviews: csvRow[pageviewsIndex ?? -1],
      },
      rowNumber,
    )
    if (!parsedMetric.ok) {
      return parsedMetric
    }

    const current = aggregatedByDate.get(parsedMetric.value.date)
    if (!current) {
      aggregatedByDate.set(parsedMetric.value.date, parsedMetric.value)
      continue
    }

    current.visitors += parsedMetric.value.visitors
    current.pageviews += parsedMetric.value.pageviews
  }

  if (parsedRowCount === 0 || aggregatedByDate.size === 0) {
    return { ok: false, error: 'No daily rows found in CSV after the header row.' }
  }

  const rows = [...aggregatedByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const coverageStartDate = rows[0]?.date
  const coverageEndDate = rows[rows.length - 1]?.date
  if (!coverageStartDate || !coverageEndDate) {
    return { ok: false, error: 'Unable to determine import coverage window from CSV.' }
  }

  return {
    ok: true,
    value: {
      source: 'plausible',
      rowCount: parsedRowCount,
      coverageStartDate,
      coverageEndDate,
      rows,
    },
  }
}

export function parseFathomDailyCsv(csvText: string): ParseFathomDailyCsvResult {
  const parsedCsv = parseCsvRows(csvText)
  if (!parsedCsv.ok) return parsedCsv

  const nonEmptyHeaderIndex = parsedCsv.rows.findIndex((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmptyHeaderIndex < 0) {
    return { ok: false, error: 'CSV is empty. Expected columns: Date, Unique visitors, Pageviews.' }
  }

  const headerRow = parsedCsv.rows[nonEmptyHeaderIndex] ?? []
  const headerIndexByName = new Map<string, number>()
  for (let i = 0; i < headerRow.length; i += 1) {
    const header = headerRow[i]
    if (header === undefined) continue
    headerIndexByName.set(normalizeCsvHeader(header), i)
  }

  const dateIndex = headerIndexByName.get('date')
  const uniqueVisitorsIndex = headerIndexByName.get('unique visitors')
  const pageviewsIndex = headerIndexByName.get('pageviews')
  const missingColumns = FATHOM_DAILY_REQUIRED_COLUMNS.filter((column) => {
    const normalized = normalizeCsvHeader(column)
    return !headerIndexByName.has(normalized)
  })
  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `Unsupported Fathom CSV format. Missing required column(s): ${missingColumns.join(', ')}.`,
    }
  }

  const aggregatedByDate = new Map<string, ImportedDailyMetric>()
  let parsedRowCount = 0

  for (let rowIndex = nonEmptyHeaderIndex + 1; rowIndex < parsedCsv.rows.length; rowIndex += 1) {
    const csvRow = parsedCsv.rows[rowIndex] ?? []
    if (csvRow.every((cell) => cell.trim() === '')) continue
    parsedRowCount += 1
    const rowNumber = rowIndex + 1

    const normalizedDate = normalizeFathomDate(csvRow[dateIndex ?? -1] ?? '')
    if (!normalizedDate) {
      return {
        ok: false,
        error: `Row ${rowNumber}: invalid date (expected YYYY-MM-DD).`,
      }
    }

    const parsedMetric = parseImportedDailyMetricRow(
      {
        date: normalizedDate,
        visitors: csvRow[uniqueVisitorsIndex ?? -1],
        pageviews: csvRow[pageviewsIndex ?? -1],
      },
      rowNumber,
    )
    if (!parsedMetric.ok) {
      return parsedMetric
    }

    const current = aggregatedByDate.get(parsedMetric.value.date)
    if (!current) {
      aggregatedByDate.set(parsedMetric.value.date, parsedMetric.value)
      continue
    }

    current.visitors += parsedMetric.value.visitors
    current.pageviews += parsedMetric.value.pageviews
  }

  if (parsedRowCount === 0 || aggregatedByDate.size === 0) {
    return { ok: false, error: 'No daily rows found in CSV after the header row.' }
  }

  const rows = [...aggregatedByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const coverageStartDate = rows[0]?.date
  const coverageEndDate = rows[rows.length - 1]?.date
  if (!coverageStartDate || !coverageEndDate) {
    return { ok: false, error: 'Unable to determine import coverage window from CSV.' }
  }

  return {
    ok: true,
    value: {
      source: 'fathom',
      rowCount: parsedRowCount,
      coverageStartDate,
      coverageEndDate,
      rows,
    },
  }
}

export function buildImportCoverageSnapshotQuery(): string {
  return `SELECT
  (SELECT MIN(strftime('%Y-%m-%d', timestamp)) FROM pageviews WHERE site_id = ?) AS native_start_date,
  (SELECT MAX(strftime('%Y-%m-%d', timestamp)) FROM pageviews WHERE site_id = ?) AS native_end_date,
  (SELECT MIN(date) FROM imported_daily_traffic WHERE site_id = ?) AS imported_start_date,
  (SELECT MAX(date) FROM imported_daily_traffic WHERE site_id = ?) AS imported_end_date`
}

export function buildImportedDailyMetricsRangeQuery(): string {
  return `SELECT
  t.date,
  t.source,
  t.visitors,
  t.pageviews,
  COALESCE(j.completed_at, j.updated_at, j.created_at) AS imported_at
FROM imported_daily_traffic t
JOIN import_jobs j ON j.id = t.import_job_id
WHERE t.site_id = ?
  AND t.date >= ?
  AND t.date < ?
  AND j.status = 'completed'
ORDER BY t.date ASC, imported_at DESC, t.source ASC`
}

export function resolveImportCoverageWindow(snapshot: ImportCoverageSnapshot): ImportCoverageWindow {
  const nativeStartDate = normalizeIsoDay(snapshot.nativeStartDate)
  const nativeEndDate = normalizeIsoDay(snapshot.nativeEndDate)
  const importedStartDate = normalizeIsoDay(snapshot.importedStartDate)
  const importedEndDate = normalizeIsoDay(snapshot.importedEndDate)

  if (!nativeStartDate && !importedStartDate) {
    return {
      mode: 'empty',
      nativeStartDate,
      nativeEndDate,
      importedStartDate,
      importedEndDate,
      cutoverDate: null,
      importedVisibleStartDate: null,
      importedVisibleEndDate: null,
    }
  }

  if (!nativeStartDate) {
    return {
      mode: 'import-only',
      nativeStartDate,
      nativeEndDate,
      importedStartDate,
      importedEndDate,
      cutoverDate: null,
      importedVisibleStartDate: importedStartDate,
      importedVisibleEndDate: importedEndDate,
    }
  }

  if (!importedStartDate || !importedEndDate) {
    return {
      mode: 'native-only',
      nativeStartDate,
      nativeEndDate,
      importedStartDate,
      importedEndDate,
      cutoverDate: null,
      importedVisibleStartDate: null,
      importedVisibleEndDate: null,
    }
  }

  const importedVisibleEndDate = importedEndDate < nativeStartDate
    ? importedEndDate
    : previousIsoDay(nativeStartDate)

  const hasVisibleImportedHistory = importedStartDate <= importedVisibleEndDate

  return {
    mode: hasVisibleImportedHistory ? 'hybrid' : 'native-only',
    nativeStartDate,
    nativeEndDate,
    importedStartDate,
    importedEndDate,
    cutoverDate: hasVisibleImportedHistory ? nativeStartDate : null,
    importedVisibleStartDate: hasVisibleImportedHistory ? importedStartDate : null,
    importedVisibleEndDate: hasVisibleImportedHistory ? importedVisibleEndDate : null,
  }
}

function mergeNativeRows(rows: NativeDailyMetricRow[]): Map<string, NativeDailyMetricRow> {
  const merged = new Map<string, NativeDailyMetricRow>()
  for (const row of rows) {
    const date = normalizeIsoDay(row.date)
    if (!date) continue
    const current = merged.get(date)
    if (!current) {
      merged.set(date, {
        date,
        visitors: row.visitors,
        pageviews: row.pageviews,
      })
      continue
    }
    current.visitors += row.visitors
    current.pageviews += row.pageviews
  }
  return merged
}

function pickMostRecentImportedRows(rows: ImportedDailyMetricRow[]): Map<string, ImportedDailyMetricRow> {
  const chosen = new Map<string, ImportedDailyMetricRow>()
  for (const row of rows) {
    const date = normalizeIsoDay(row.date)
    if (!date) continue
    const current = chosen.get(date)
    if (!current) {
      chosen.set(date, { ...row, date })
      continue
    }

    if (row.importedAt > current.importedAt) {
      chosen.set(date, { ...row, date })
      continue
    }

    if (row.importedAt === current.importedAt && row.source < current.source) {
      chosen.set(date, { ...row, date })
    }
  }
  return chosen
}

export function mergeDailyMetrics(
  nativeRows: NativeDailyMetricRow[],
  importedRows: ImportedDailyMetricRow[]
): MergedDailyMetric[] {
  const nativeByDate = mergeNativeRows(nativeRows)
  const importedByDate = pickMostRecentImportedRows(importedRows)
  const allDates = new Set<string>([...nativeByDate.keys(), ...importedByDate.keys()])

  return [...allDates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const native = nativeByDate.get(date)
      if (native) {
        return {
          date,
          visitors: native.visitors,
          pageviews: native.pageviews,
          dataSource: 'native',
        }
      }

      const imported = importedByDate.get(date)
      // imported is guaranteed by allDates union when native is absent.
      if (!imported) throw new Error(`Missing imported row for date: ${date}`)
      return {
        date,
        visitors: imported.visitors,
        pageviews: imported.pageviews,
        dataSource: imported.source,
      }
    })
}
