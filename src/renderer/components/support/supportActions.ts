import { markSupported, parseNudgeState, type NudgeState } from '../../core/supportNudge'
import { shareUrl } from '../../config/support'

const STORAGE_KEY = 'inkline:support'

/** Per-browser nudge state. Storage can be blocked (private mode, policies)
 *  — then every read is "fresh" and writes are silently dropped. */
export function loadNudgeState(): NudgeState {
  try {
    return parseNudgeState(localStorage.getItem(STORAGE_KEY))
  } catch {
    return parseNudgeState(null)
  }
}

export function saveNudgeState(state: NudgeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Not persisted — the worst case is seeing the card again another day.
  }
}

/** Called when the user clicks through to Ko-fi or says they've supported. */
export function rememberSupport(): void {
  saveNudgeState(markSupported(loadNudgeState(), Date.now()))
}

export type ShareOutcome = 'shared' | 'copied' | 'failed'

/** Native share sheet where available (phones), otherwise copy the link. */
export async function shareInkline(): Promise<ShareOutcome> {
  const url = shareUrl()
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (nav.share && window.matchMedia?.('(pointer: coarse)').matches) {
    try {
      await nav.share({
        title: 'Inkline — a genuinely free PDF editor',
        text: 'Edit, sign and fill PDFs for free — no sign-up, no watermark, no export paywall.',
        url
      })
      return 'shared'
    } catch {
      // Dismissed or unsupported — fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
