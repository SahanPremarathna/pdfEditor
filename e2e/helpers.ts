import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Download, type Locator, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

/** Shared helpers for the e2e specs. */
export const SHOTS = process.env.SHOTS_DIR ?? join('test-results', 'shots')
export const standardFontDataUrl = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'
export const LETTER = { width: 612, height: 792 }
export const UNICODE_TEXT = 'Hello “Inkline” → ශ්‍රී'

export async function makeFixturePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const label of ['First page', 'Second page']) {
    const page = doc.addPage([LETTER.width, LETTER.height])
    page.drawText(label, { x: 72, y: 700, size: 24, font })
  }
  const form = doc.getForm()
  const name = form.createTextField('full_name')
  name.addToPage(doc.getPage(0), { x: 72, y: 600, width: 200, height: 24 })
  const agree = form.createCheckBox('agree')
  agree.addToPage(doc.getPage(0), { x: 72, y: 560, width: 16, height: 16 })
  return Buffer.from(await doc.save())
}

export async function readPdf(download: Download): Promise<Uint8Array> {
  const path = await download.path()
  return new Uint8Array(readFileSync(path))
}

export async function pageText(bytes: Uint8Array, pageNumber: number): Promise<TextItem[]> {
  const doc = await getDocument({ data: bytes.slice(), standardFontDataUrl }).promise
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  return (content.items as TextItem[]).filter((i) => i.str.trim().length > 0)
}

export async function forceInputFallback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.showOpenFilePicker
    delete w.showSaveFilePicker
  })
}

export async function openFixture(page: Page, name = 'contract.pdf'): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Open a PDF/ }).click()
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: await makeFixturePdf() })
  await expect(page.getByRole('region', { name: 'Page 1' })).toBeVisible()
}

/** Page-relative drag in CSS px. */
export async function drag(page: Page, target: Locator, from: [number, number], to: [number, number]): Promise<void> {
  const box = await target.boundingBox()
  if (!box) throw new Error('target not visible')
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  const steps = 8
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(box.x + from[0] + ((to[0] - from[0]) * i) / steps, box.y + from[1] + ((to[1] - from[1]) * i) / steps)
  }
  await page.mouse.up()
}

export async function clickAt(page: Page, target: Locator, x: number, y: number): Promise<void> {
  const box = await target.boundingBox()
  if (!box) throw new Error('target not visible')
  await page.mouse.click(box.x + x, box.y + y)
}

export async function deselect(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
}

/** Must match E2E_KOFI_URL in playwright.config.ts (the e2e build's env). */
export const E2E_KOFI_URL = 'https://ko-fi.com/inkline-e2e'
