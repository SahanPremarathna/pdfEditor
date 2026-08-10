// Build-time only (not bundled into the app): generates a placeholder,
// programmatic app icon as build/icon.ico, since no external image tooling
// (ImageMagick, sharp, etc.) is available to convert real artwork. Pure
// Node — no dependencies — using a hand-rolled PNG encoder (zlib is
// built in) and PNG-in-ICO frames, which Windows Vista+ supports at any
// listed size, not just 256. Swap this file's design (or just replace
// build/icon.ico directly) once real branding art exists.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'build')

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

/** rgba: Buffer of size*size*4 bytes, row-major top-to-bottom, RGBA8. */
function encodePng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type: RGBA
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
  const ihdr = pngChunk('IHDR', ihdrData)

  const rowBytes = size * 4
  const raw = Buffer.alloc((rowBytes + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0 // filter: None
    rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, y * rowBytes + rowBytes)
  }
  const idat = pngChunk('IDAT', deflateSync(raw))

  const iend = pngChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// ---- Placeholder "Inkline" design: flat rounded-square background, a
// simplified folded-corner document, and a diagonal ink-stroke crossing it
// (ink + line). Rendered via plain analytic region tests (no shape library),
// supersampled 4x and box-downsampled for cheap anti-aliasing. ----

const BG = [67, 56, 202, 255] // indigo-700
const PAGE = [255, 255, 255, 255]
const STROKE = [245, 158, 11, 255] // amber-500

function insideRoundedRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false
  const cx = Math.min(Math.max(px, x0 + r), x1 - r)
  const cy = Math.min(Math.max(py, y0 + r), y1 - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

function insideFoldedDoc(px, py, x0, y0, x1, y1, fold) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false
  return x1 - px + (py - y0) >= fold
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const lenSq = abx * abx + aby * aby
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq))
  const cx = ax + t * abx
  const cy = ay + t * aby
  const dx = px - cx
  const dy = py - cy
  return Math.sqrt(dx * dx + dy * dy)
}

function renderAt(size) {
  const rgba = Buffer.alloc(size * size * 4)

  const bgMargin = size * 0.06
  const bgR = size * 0.22
  const docX0 = size * 0.28
  const docY0 = size * 0.2
  const docX1 = size * 0.72
  const docY1 = size * 0.82
  const fold = (docX1 - docX0) * 0.28
  const strokeHalfWidth = size * 0.05
  const strokeA = { x: size * 0.16, y: size * 0.82 }
  const strokeB = { x: size * 0.86, y: size * 0.2 }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let color = [0, 0, 0, 0]

      if (insideRoundedRect(px, py, bgMargin, bgMargin, size - bgMargin, size - bgMargin, bgR)) {
        color = BG
      }
      if (insideFoldedDoc(px, py, docX0, docY0, docX1, docY1, fold)) {
        color = PAGE
      }
      if (distToSegment(px, py, strokeA.x, strokeA.y, strokeB.x, strokeB.y) <= strokeHalfWidth) {
        color = STROKE
      }

      const i = (y * size + x) * 4
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = color[3]
    }
  }
  return rgba
}

/** Renders at `size * factor` then box-downsamples by `factor` for
 *  anti-aliasing, without any supersampling/resize library. */
function renderAntiAliased(size, factor = 4) {
  const hi = size * factor
  const hiBuf = renderAt(hi)
  const out = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const hx = x * factor + dx
          const hy = y * factor + dy
          const i = (hy * hi + hx) * 4
          r += hiBuf[i]
          g += hiBuf[i + 1]
          b += hiBuf[i + 2]
          a += hiBuf[i + 3]
        }
      }
      const n = factor * factor
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

function buildIco(sizes) {
  const pngBuffers = sizes.map((size) => encodePng(size, renderAntiAliased(size)))

  const headerSize = 6
  const entrySize = 16
  let offset = headerSize + entrySize * sizes.length

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(sizes.length, 4)

  const entries = []
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const png = pngBuffers[i]
    const entry = Buffer.alloc(entrySize)
    entry[0] = size >= 256 ? 0 : size // width (0 means 256)
    entry[1] = size >= 256 ? 0 : size // height
    entry[2] = 0 // color count
    entry[3] = 0 // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8) // bytes in resource
    entry.writeUInt32LE(offset, 12) // offset
    entries.push(entry)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...pngBuffers])
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'icon.ico'), buildIco([16, 32, 48, 256]))
writeFileSync(join(OUT_DIR, 'icon-preview.png'), encodePng(256, renderAntiAliased(256)))
console.log('Wrote build/icon.ico and build/icon-preview.png')
