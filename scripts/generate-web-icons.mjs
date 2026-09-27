// Renders public/favicon.svg to the PNG sizes the web manifest references.
// Build-time only; uses Playwright's Chromium (a dev dependency) as the rasterizer.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8')

// Prefer the system Chrome so no separate browser download is needed.
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
try {
  for (const size of [192, 512]) {
    // Maskable-safe: the mark sits inside the central 80% on a solid background.
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(
      `<html><body style="margin:0;background:#0b0b1a;display:grid;place-items:center;height:100vh">` +
        `<div style="width:${Math.round(size * 0.8)}px;height:${Math.round(size * 0.8)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>` +
        `</body></html>`
    )
    await page.screenshot({ path: join(root, 'public', 'icons', `icon-${size}.png`) })
    await page.close()
  }
} finally {
  await browser.close()
}
console.log('Wrote public/icons/icon-192.png and icon-512.png')
