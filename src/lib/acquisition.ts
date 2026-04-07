import { buildInternalOrTestEmailSql } from './internalTraffic'

export type AcquisitionRange = '7d' | '30d' | '90d'

export interface AcquisitionWindow {
  range: AcquisitionRange
  rangeLabel: string
  timezoneLabel: string
  startDate: Date
  endDate: Date
  startISO: string
  endISO: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function normalizeAcquisitionRange(range: string | undefined): AcquisitionRange {
  if (range === '30d' || range === '90d') {
    return range
  }
  return '7d'
}

export function buildAcquisitionWindow(now: Date, requestedRange: string | undefined): AcquisitionWindow {
  const range = normalizeAcquisitionRange(requestedRange)
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endDate = new Date(todayUTC.getTime() + DAY_MS)
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
  const startDate = new Date(todayUTC.getTime() - (days - 1) * DAY_MS)

  return {
    range,
    rangeLabel: range === '90d' ? 'Last 90 Days' : range === '30d' ? 'Last 30 Days' : 'Last 7 Days',
    timezoneLabel: 'UTC',
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
  }
}

export function buildAcquisitionUserScopeClause(includeInternal: boolean, userAlias = 'u'): string {
  if (includeInternal) return ''

  return `AND COALESCE(${userAlias}.first_touch_is_internal, 0) = 0
       AND NOT ${buildInternalOrTestEmailSql(`${userAlias}.email`)}`
}
