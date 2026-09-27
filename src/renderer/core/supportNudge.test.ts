import { describe, expect, it } from 'vitest'
import {
  FRESH_NUDGE_STATE,
  markDismissedForever,
  markShown,
  markSupported,
  NUDGE_INTERVAL_MS,
  parseNudgeState,
  QUIET_AFTER_SUPPORT_MS,
  recordExport,
  shouldShowNudge
} from './supportNudge'

const T0 = 1_700_000_000_000
const afterExports = (n: number): typeof FRESH_NUDGE_STATE => {
  let s = FRESH_NUDGE_STATE
  for (let i = 0; i < n; i++) s = recordExport(s)
  return s
}

describe('shouldShowNudge', () => {
  it('never shows before any export', () => {
    expect(shouldShowNudge(afterExports(0), T0)).toBe(false)
  })

  it('shows from the first export', () => {
    expect(shouldShowNudge(afterExports(1), T0)).toBe(true)
  })

  it('waits a week between showings', () => {
    const shown = markShown(afterExports(5), T0)
    expect(shouldShowNudge(shown, T0 + NUDGE_INTERVAL_MS - 1)).toBe(false)
    expect(shouldShowNudge(shown, T0 + NUDGE_INTERVAL_MS)).toBe(true)
  })

  it('stays hidden forever once dismissed', () => {
    expect(shouldShowNudge(markDismissedForever(afterExports(10)), T0 + 10 * NUDGE_INTERVAL_MS)).toBe(false)
  })

  it('stays quiet for 60 days after supporting', () => {
    const supported = markSupported(afterExports(3), T0)
    expect(shouldShowNudge(supported, T0 + QUIET_AFTER_SUPPORT_MS - 1)).toBe(false)
    expect(shouldShowNudge(supported, T0 + QUIET_AFTER_SUPPORT_MS)).toBe(true)
  })
})

describe('parseNudgeState', () => {
  it('treats missing or corrupt storage as fresh', () => {
    expect(parseNudgeState(null)).toEqual(FRESH_NUDGE_STATE)
    expect(parseNudgeState('{nope')).toEqual(FRESH_NUDGE_STATE)
    expect(parseNudgeState('42')).toEqual(FRESH_NUDGE_STATE)
  })

  it('round-trips and sanitizes fields', () => {
    const state = markShown(recordExport(recordExport(FRESH_NUDGE_STATE)), T0)
    expect(parseNudgeState(JSON.stringify(state))).toEqual(state)
    expect(parseNudgeState('{"exports":-3,"dismissedForever":"yes","lastShownAt":"x"}')).toEqual(FRESH_NUDGE_STATE)
  })
})
