import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Download, type Locator, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

/*
 * Drives the production build end to end: every tool, forms, watermark,
 * page operations, undo/redo, Save (read back and checked with pdf.js),
 * page extraction, recent files and offline reload.
 *
 * The File System Access pickers are removed in the page so the plain
 * <input type=file> + download fallback is exercised — that's the path
 * Firefox/Safari users get, and the one Playwright can automate.
 */

const SHOTS = process.env.SHOTS_DIR ?? join('test-results', 'shots')
const standardFontDataUrl = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'
const LETTER = { width: 612, height: 792 }
const UNICODE_TEXT = 'Hello “Inkline” → ශ්‍රී'

async function makeFixturePdf(): Promise<Buffer> {
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

async function readPdf(download: Download): Promise<Uint8Array> {
  const path = await download.path()
  return new Uint8Array(readFileSync(path))
}

async function pageText(bytes: Uint8Array, pageNumber: number): Promise<TextItem[]> {
  const doc = await getDocument({ data: bytes.slice(), standardFontDataUrl }).promise
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  return (content.items as TextItem[]).filter((i) => i.str.trim().length > 0)
}

async function forceInputFallback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.showOpenFilePicker
    delete w.showSaveFilePicker
  })
}

async function openFixture(page: Page, name = 'contract.pdf'): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Open a PDF/ }).click()
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: await makeFixturePdf() })
  await expect(page.getByRole('region', { name: 'Page 1' })).toBeVisible()
}

/** Page-relative drag in CSS px. */
async function drag(page: Page, target: Locator, from: [number, number], to: [number, number]): Promise<void> {
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

async function clickAt(page: Page, target: Locator, x: number, y: number): Promise<void> {
  const box = await target.boundingBox()
  if (!box) throw new Error('target not visible')
  await page.mouse.click(box.x + x, box.y + y)
}

async function deselect(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
}

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true })
})

test('welcome screen renders in light and dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Edit PDFs/ })).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(SHOTS, 'welcome-light.png') })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(SHOTS, 'welcome-dark.png') })
})

test('full editing round trip', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  await forceInputFallback(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await openFixture(page)

  const page1 = page.getByRole('region', { name: 'Page 1' })
  const box1 = await page1.boundingBox()
  if (!box1) throw new Error('page 1 not visible')
  const scale = box1.width / LETTER.width

  // --- Text (with curly quotes, an arrow and Sinhala) ---
  await page.keyboard.press('t')
  const textAt: [number, number] = [120, 140]
  await clickAt(page, page1, ...textAt)
  const editor = page1.locator('textarea')
  await expect(editor).toBeFocused()
  await page.keyboard.insertText(UNICODE_TEXT)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Text' })).toBeVisible()
  // Widen it so the whole string stays on one line, via the inspector.
  await page.getByRole('spinbutton', { name: 'Width' }).fill('320')
  await deselect(page)

  // --- Shapes and markup ---
  await page.keyboard.press('r')
  await drag(page, page1, [120, 260], [260, 330])
  await deselect(page)
  await page.keyboard.press('e')
  await drag(page, page1, [300, 260], [420, 330])
  await deselect(page)
  await page.keyboard.press('l')
  await drag(page, page1, [120, 360], [300, 380])
  await deselect(page)
  await page.keyboard.press('a')
  await drag(page, page1, [120, 400], [300, 440])
  await deselect(page)
  await page.keyboard.press('p')
  await drag(page, page1, [450, 400], [560, 470])
  await deselect(page)
  await page.keyboard.press('h')
  await drag(page, page1, [100, 60], [400, 100])
  await deselect(page)
  await page.keyboard.press('w')
  await drag(page, page1, [500, 60], [640, 100])
  await expect(page.getByText(/does not remove them/)).toBeVisible()
  await deselect(page)

  // --- Image (tool click opens a picker) ---
  await page.keyboard.press('i')
  const imageChooser = page.waitForEvent('filechooser')
  await clickAt(page, page1, 500, 520)
  await (await imageChooser).setFiles(join('public', 'icons', 'icon-192.png'))
  await expect(page.getByRole('heading', { name: 'Image' })).toBeVisible()
  // Duplicate + nudge via keyboard (each one undo step).
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Shift+ArrowRight')
  await deselect(page)

  // --- Signature ---
  await page.keyboard.press('s')
  await clickAt(page, page1, 150, 600)
  const pad = page.getByRole('dialog', { name: 'Draw your signature' }).locator('canvas').first()
  await drag(page, pad, [40, 100], [200, 60])
  await drag(page, pad, [200, 60], [320, 110])
  await page.getByRole('button', { name: 'Place signature' }).click()
  await deselect(page)

  // --- Undo / redo of an object ---
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  const redo = page.getByRole('button', { name: 'Redo', exact: true })
  await undo.click()
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(redo).toBeDisabled()

  // --- Forms (panel shows once nothing is selected) ---
  const formsPanel = page.locator('aside', { hasText: 'Form fields' })
  await expect(formsPanel).toBeVisible()
  await formsPanel.getByRole('textbox').first().fill('Ada Lovelace')
  await formsPanel.getByRole('checkbox').first().check()

  // --- Watermark ---
  await page.getByRole('button', { name: 'Watermark' }).click()
  const wmPanel = page.locator('aside', { hasText: 'Show watermark' })
  await wmPanel.getByRole('checkbox').check()
  await wmPanel.getByRole('button', { name: /Apply to pages/ }).click()
  await expect(wmPanel.getByText('Currently on 2 pages')).toBeVisible()
  await page.getByRole('button', { name: 'Close Watermark' }).click()

  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SHOTS, 'editor-light.png') })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(SHOTS, 'editor-dark.png') })
  await page.emulateMedia({ colorScheme: 'light' })

  // --- Page operations (+ undo/redo of them) ---
  const pagesPanel = page.locator('aside', { hasText: 'Add page' })
  const thumbs = pagesPanel.locator('[draggable="true"]')
  await expect(thumbs).toHaveCount(2)
  await thumbs.nth(0).hover()
  await pagesPanel.getByRole('button', { name: 'Duplicate page' }).first().click()
  await expect(thumbs).toHaveCount(3)
  await thumbs.nth(1).hover()
  await pagesPanel.getByRole('button', { name: 'Delete page' }).nth(1).click()
  await expect(thumbs).toHaveCount(2)
  await undo.click()
  await expect(thumbs).toHaveCount(3)
  await redo.click()
  await expect(thumbs).toHaveCount(2)
  await thumbs.nth(1).hover()
  await pagesPanel.getByRole('button', { name: 'Rotate page right' }).nth(1).click()

  // --- Save → read back ---
  const saveDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Save/ }).click()
  const saved = await readPdf(await saveDownload)
  await expect(page.getByText(/flattened/)).toBeVisible() // page ops force-flatten the form

  const out = await PDFDocument.load(saved)
  expect(out.getPageCount()).toBe(2)
  expect(out.getPage(1).getRotation().angle).toBe(90)

  const items1 = await pageText(saved, 1)
  const joined1 = items1.map((i) => i.str).join('')
  expect(joined1).toContain('Hello')
  expect(joined1).toContain('Inkline')
  expect(joined1).toContain('→')
  expect(joined1).toContain('Ada Lovelace')
  expect(joined1).toContain('CONFIDENTIAL')
  expect(joined1).toContain('First page')

  // The text object's first run lands where it was placed (±1pt): x at the
  // click, baseline one Helvetica ascent (0.718em at 14pt) below the click.
  const hello = items1.find((i) => i.str.startsWith('Hello'))
  if (!hello) throw new Error('text object missing from export')
  expect(Math.abs(hello.transform[4] - textAt[0] / scale)).toBeLessThan(1)
  expect(Math.abs(hello.transform[5] - (LETTER.height - textAt[1] / scale - 0.718 * 14))).toBeLessThan(1)

  const items2 = await pageText(saved, 2)
  expect(items2.map((i) => i.str).join('')).toContain('Second page')
  expect(items2.map((i) => i.str).join('')).toContain('CONFIDENTIAL')

  // Images (the placed PNG and its duplicate) and vector paths are real PDF content.
  const readBack = await getDocument({ data: saved.slice(), standardFontDataUrl }).promise
  const ops = await (await readBack.getPage(1)).getOperatorList()
  expect(ops.fnArray.filter((fn) => fn === OPS.paintImageXObject).length).toBeGreaterThanOrEqual(2)
  expect(ops.fnArray.filter((fn) => fn === OPS.constructPath).length).toBeGreaterThanOrEqual(6)

  // --- Extract a page ---
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('button', { name: /Extract pages/ }).click()
  await page.getByPlaceholder('e.g. 1-3, 5, 8-').fill('2')
  const extractDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Extract', exact: true }).click()
  const extractedDl = await extractDownload
  expect(extractedDl.suggestedFilename()).toBe('contract (page 2).pdf')
  const extracted = await PDFDocument.load(await readPdf(extractedDl))
  expect(extracted.getPageCount()).toBe(1)

  // --- Close → recent files → reopen the saved version ---
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('button', { name: /Close document/ }).click()
  await expect(page.getByRole('heading', { name: /Edit PDFs/ })).toBeVisible()
  await page.getByRole('button', { name: /^contract\.pdf/ }).click()
  await expect(page.getByRole('region', { name: 'Page 2' })).toBeVisible()
  await expect(page.getByText('1 / 2')).toBeVisible()

  expect(pageErrors).toEqual([])
})

test('drag-and-drop opening', async ({ page }) => {
  await page.goto('/')
  const bytes = await makeFixturePdf()
  // Simulate an OS file drop on the window.
  await page.evaluate(async (data) => {
    const file = new File([new Uint8Array(data)], 'dropped.pdf', { type: 'application/pdf' })
    const dt = new DataTransfer()
    dt.items.add(file)
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  }, [...bytes])
  await expect(page.getByRole('region', { name: 'Page 1' })).toBeVisible()
  await expect(page.getByText('dropped.pdf')).toBeVisible()

  // Ctrl + wheel zooms the document (not the browser UI).
  await expect(page.getByText('Fit', { exact: true })).toBeVisible()
  const pageBox = await page.getByRole('region', { name: 'Page 1' }).boundingBox()
  if (!pageBox) throw new Error('page not visible')
  await page.mouse.move(pageBox.x + 200, pageBox.y + 200)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 200)
  await page.keyboard.up('Control')
  await expect(page.getByText(/^\d+%$/)).toBeVisible()
  const zoomed = await page.getByRole('region', { name: 'Page 1' }).boundingBox()
  expect(zoomed?.width ?? 0).toBeLessThan(pageBox.width)

  // "?" opens the shortcuts sheet; Escape closes it.
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden()
})

test('works offline after the first visit', async ({ page, context }) => {
  await forceInputFallback(page)
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Reload once so the page is controlled, then let the font prefetch run.
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await page.waitForTimeout(6000)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Edit PDFs/ })).toBeVisible()

  await openFixture(page, 'offline.pdf')
  const page1 = page.getByRole('region', { name: 'Page 1' })
  await page.keyboard.press('t')
  await clickAt(page, page1, 100, 100)
  await expect(page1.locator('textarea')).toBeFocused()
  await page.keyboard.insertText('Offline → ✓')
  await page.keyboard.press('Enter')
  await deselect(page)

  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Save/ }).click()
  const saved = await readPdf(await dl)
  const text = (await pageText(saved, 1)).map((i) => i.str).join('')
  expect(text).toContain('Offline')
  expect(text).toContain('→')
  await context.setOffline(false)
})

test('phone layout', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await forceInputFallback(page)
  await page.goto('/')
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SHOTS, 'mobile-welcome.png') })
  await openFixture(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SHOTS, 'mobile-editor.png') })
  // Nothing may overflow horizontally at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await context.close()
})
