/**
 * When to (rarely) show the "enjoying Inkline? support it" card after an
 * export. Pure — persistence lives in the component; this only decides.
 * Nothing here ever blocks or delays a save: the card appears after the
 * file is already written.
 */

export interface NudgeState {
  exports: number
  lastShownAt: number | null
  dismissedForever: boolean
  supportedAt: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000
export const FIRST_NUDGE_AT_EXPORT = 2
export const NUDGE_INTERVAL_MS = 7 * DAY_MS
export const QUIET_AFTER_SUPPORT_MS = 60 * DAY_MS

export const FRESH_NUDGE_STATE: NudgeState = { exports: 0, lastShownAt: null, dismissedForever: false, supportedAt: null }

export function recordExport(state: NudgeState): NudgeState {
  return { ...state, exports: state.exports + 1 }
}

export function shouldShowNudge(state: NudgeState, now: number): boolean {
  if (state.dismissedForever) return false
  if (state.exports < FIRST_NUDGE_AT_EXPORT) return false
  if (state.supportedAt !== null && now - state.supportedAt < QUIET_AFTER_SUPPORT_MS) return false
  return state.lastShownAt === null || now - state.lastShownAt >= NUDGE_INTERVAL_MS
}

export const markShown = (state: NudgeState, now: number): NudgeState => ({ ...state, lastShownAt: now })
export const markDismissedForever = (state: NudgeState): NudgeState => ({ ...state, dismissedForever: true })
export const markSupported = (state: NudgeState, now: number): NudgeState => ({ ...state, supportedAt: now })

/** Parses stored JSON defensively — anything malformed counts as a fresh state. */
export function parseNudgeState(raw: string | null): NudgeState {
  if (!raw) return FRESH_NUDGE_STATE
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v !== 'object' || v === null) return FRESH_NUDGE_STATE
    const o = v as Record<string, unknown>
    const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
    return {
      exports: Math.max(0, Math.floor(num(o.exports) ?? 0)),
      lastShownAt: num(o.lastShownAt),
      dismissedForever: o.dismissedForever === true,
      supportedAt: num(o.supportedAt)
    }
  } catch {
    return FRESH_NUDGE_STATE
  }
}
