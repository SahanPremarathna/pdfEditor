import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { beforeAll, describe, expect, it } from 'vitest'
import { createFontRegistry } from './fonts'

// node:fs is only ever used here, inside the vitest/Node test harness, to load
// a test fixture — the "renderer never imports fs" rule (CLAUDE.md) is about
// the shipped app's process-isolation boundary, not this test file.
let fixtureBytes: Uint8Array

beforeAll(() => {
  fixtureBytes = readFileSync(join(__dirname, '__fixtures__', 'test-sans.ttf'))
})

describe('FontRegistry', () => {
  it('caches embed() so repeat calls for the same family return the identical PDFFont', async () => {
    const doc = await PDFDocument.create()
    const registry = createFontRegistry(doc)
    registry.registerSource({ family: 'test-sans', bytes: fixtureBytes })

    const first = await registry.embed('test-sans')
    const second = await registry.embed('test-sans')

    expect(second).toBe(first)
  })

  it('gives independent PDFFont instances for the same family across independent documents', async () => {
    const docA = await PDFDocument.create()
    const docB = await PDFDocument.create()
    const registryA = createFontRegistry(docA)
    const registryB = createFontRegistry(docB)
    registryA.registerSource({ family: 'test-sans', bytes: fixtureBytes })
    registryB.registerSource({ family: 'test-sans', bytes: fixtureBytes })

    const fontA = await registryA.embed('test-sans')
    const fontB = await registryB.embed('test-sans')

    expect(fontA).not.toBe(fontB)
  })

  it('rejects embed() for a family with no registered source', async () => {
    const doc = await PDFDocument.create()
    const registry = createFontRegistry(doc)

    await expect(registry.embed('unregistered')).rejects.toThrow()
  })

  it('embedStandard caches so repeat calls return the identical PDFFont', async () => {
    const doc = await PDFDocument.create()
    const registry = createFontRegistry(doc)

    const first = registry.embedStandard(StandardFonts.Helvetica)
    const second = registry.embedStandard(StandardFonts.Helvetica)

    expect(second).toBe(first)
  })

  it('solves the WinAnsi limitation: standard fonts cannot measure non-Latin1 text, the fontkit-embedded registry font can', async () => {
    const doc = await PDFDocument.create()
    const registry = createFontRegistry(doc)
    registry.registerSource({ family: 'test-sans', bytes: fixtureBytes })

    const standardFont = registry.embedStandard(StandardFonts.Helvetica)
    expect(() => standardFont.widthOfTextAtSize('Я', 12)).toThrow()

    const customFont = await registry.embed('test-sans')
    expect(() => customFont.widthOfTextAtSize('Я', 12)).not.toThrow()
  })
})
