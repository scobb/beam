export const ACTIVATION_WINDOW_MIN_HOURS = 20
export const ACTIVATION_WINDOW_MAX_HOURS = 28

export function activationWindowBounds(now: Date): { earliest: string; latest: string } {
  const maxHoursAgo = new Date(now.getTime() - ACTIVATION_WINDOW_MAX_HOURS * 60 * 60 * 1000)
  const minHoursAgo = new Date(now.getTime() - ACTIVATION_WINDOW_MIN_HOURS * 60 * 60 * 1000)
  return { earliest: maxHoursAgo.toISOString(), latest: minHoursAgo.toISOString() }
}
