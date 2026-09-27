/**
 * Text outside WinAnsi (arrows, non-Latin scripts) must export through the
 * bundled Noto TTFs instead of throwing — and land at the same position the
 * standard-font path would have used.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { describe, expect, it } from 'vitest'
import { exportPdf } from './exportPdf'
import { identityPagesFor } from './exportPdf.testHelpers'
import { createTextObject } from './objects'
import type { TextObject } from '../../shared/types'

const FONT_DIR = join(__dirname, '..', '..', '..', 'public', 'fonts')
const standardFontDataUrl = join(__dirname, '..', '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'

const loadFont = async (file: string): Promise<Uint8Array> => new Uint8Array(await readFile(join(FONT_DIR, file)))

async function exportText(obj: TextObject, withLoader = true): Promise<TextItem[]> {
  const source = await PDFDocument.create()
  source.addPage([595.28, 841.89])
  const { bytes } = await exportPdf(
    await source.save(),
    { 0: [obj] },
    identityPagesFor(source),
    {},
    [],
    false,
    null,
    withLoader ? { loadFont } : {}
  )
  const doc = await getDocument({ data: bytes, standardFontDataUrl }).promise
  const content = await (await doc.getPage(1)).getTextContent()
  return (content.items as TextItem[]).filter((i) => i.str.length > 0)
}

describe('exportPdf — Unicode text', () => {
  it('exports arrows and emoji-free symbols with Noto Sans and keeps the text extractable', async () => {
    const obj = createTextObject(0, 72, 72, 0, { text: 'Total → 42 ≥ 40', width: 400 }, () => 'u1')
    const items = await exportText(obj)
    expect(items.map((i) => i.str).join('')).toBe('Total → 42 ≥ 40')
  })

  it('places the first run at the object origin, same as the standard-font path', async () => {
    const latin = createTextObject(0, 72, 72, 0, { text: 'Hello', width: 400 }, () => 'a')
    const unicode = createTextObject(0, 72, 72, 0, { text: 'Hello →', width: 400 }, () => 'b')
    const [latinItem] = await exportText(latin)
    const [unicodeItem] = await exportText(unicode)
    expect(unicodeItem.transform[4]).toBeCloseTo(latinItem.transform[4], 3)
    expect(unicodeItem.transform[5]).toBeCloseTo(latinItem.transform[5], 3)
  })

  it('draws mixed Latin + Sinhala + Tamil as consecutive runs on one baseline', async () => {
    const obj = createTextObject(0, 72, 100, 0, { text: 'Hi ශ්‍රී தமிழ்', width: 500 }, () => 'c')
    const items = await exportText(obj)
    expect(items.length).toBeGreaterThanOrEqual(2)
    const baselines = new Set(items.map((i) => i.transform[5].toFixed(2)))
    expect(baselines.size).toBe(1)
    // Runs advance left to right.
    const xs = items.map((i) => i.transform[4])
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it('still honors bold/italic and serif on the Unicode path', async () => {
    const obj = createTextObject(
      0,
      72,
      72,
      0,
      { text: 'Serif → bold', fontFamily: 'serif', bold: true, italic: true, width: 400 },
      () => 'd'
    )
    const items = await exportText(obj)
    expect(items.map((i) => i.str).join('')).toBe('Serif → bold')
  })

  it('throws a clear error when no font loader is supplied', async () => {
    const obj = createTextObject(0, 72, 72, 0, { text: '→' }, () => 'e')
    await expect(exportText(obj, false)).rejects.toThrow(/bundled font/)
  })

  it('keeps pure WinAnsi text on the standard fonts (no TTF embedded)', async () => {
    const source = await PDFDocument.create()
    source.addPage([200, 200])
    const obj = createTextObject(0, 10, 10, 0, { text: '“Quoted” — fine' }, () => 'f')
    let loads = 0
    const { bytes } = await exportPdf(await source.save(), { 0: [obj] }, identityPagesFor(source), {}, [], false, null, {
      loadFont: async (file) => {
        loads++
        return loadFont(file)
      }
    })
    expect(loads).toBe(0)
    expect(bytes.byteLength).toBeLessThan(5000)
  })
})
