import './pdfWorker'
import { getDocument, PasswordException, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import { normalizeRotation, type PageRotation } from './coords'

export type { PDFDocumentProxy }

/**
 * pdfjs-dist's `PasswordException` (unlike pdf-lib's tslib-downleveled error
 * classes elsewhere in this app) has a correctly-set-up prototype chain, so
 * `instanceof` genuinely works here — no message-sniffing needed. Detection
 * only: this rewrites to one friendly message regardless of whether the file
 * needs a password at all or a wrong one was supplied (PasswordResponses'
 * NEED_PASSWORD vs INCORRECT_PASSWORD), since there is no retry/prompt UI to
 * make that distinction meaningful.
 */
export async function loadDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const task = getDocument({ data: bytes })
  try {
    return await task.promise
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new Error('This PDF is password-protected. Inkline cannot open password-protected PDFs yet.')
    }
    throw err
  }
}

/** Page size in CSS px at scale 1 — pdf.js bakes /Rotate into this, per spec §4.
 *  `additionalRotationDeg` is a user-applied delta (PageMeta.rotation) ON TOP
 *  of the page's own /Rotate — pdf.js's `rotation` option to getViewport
 *  OVERRIDES the page's baked rotation rather than adding to it ("if omitted
 *  it defaults to the page rotation", per pdf.js's own docs), so combining
 *  the two means reading `page.rotate` first and adding the delta ourselves. */
export async function getPageSize(
  doc: PDFDocumentProxy,
  pageNumber: number,
  additionalRotationDeg: PageRotation = 0
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const rotation = normalizeRotation(page.rotate + additionalRotationDeg)
  const viewport = page.getViewport({ scale: 1, rotation })
  return { width: viewport.width, height: viewport.height }
}

export interface RenderHandle {
  promise: Promise<void>
  cancel: () => void
}

/**
 * `shouldAbort` is checked right before `page.render()` is called, not just after.
 * pdf.js throws synchronously if `render()` is called again on a canvas that a
 * not-yet-cancelled previous task is still using (`InternalRenderTask`'s
 * `#canvasInUse` guard) — React 18 StrictMode's dev-mode double-effect-invoke
 * triggers this every time otherwise, since the superseded run's own `cancel()`
 * doesn't happen until after its `doc.getPage()` await resolves, by which point
 * the new run's `render()` call has already lost the race. Checking staleness
 * before ever calling `render()` avoids the conflict entirely instead of just
 * surfacing it.
 */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  shouldAbort?: () => boolean,
  additionalRotationDeg: PageRotation = 0
): Promise<RenderHandle | null> {
  const page = await doc.getPage(pageNumber)
  if (shouldAbort?.()) return null

  const rotation = normalizeRotation(page.rotate + additionalRotationDeg)
  const viewport = page.getViewport({ scale, rotation })

  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  const renderTask: RenderTask = page.render({ canvas, viewport })

  return {
    promise: renderTask.promise.then(() => undefined),
    cancel: () => renderTask.cancel()
  }
}
