// Renders public/og-image.png (1200×630) — the preview card shown when
// truefreepdf.com is shared on WhatsApp, Facebook, LinkedIn, X, Slack, etc.
// Build-time only; uses Playwright's Chromium (a dev dependency) to rasterize.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logo = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ')
const inter = join(root, 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2')
// Inlined as a data URL — a page built with setContent can't load file:// fonts.
const interUrl = 'data:font/woff2;base64,' + readFileSync(inter).toString('base64')

const check = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const promises = ['No sign-up', 'No watermark', 'No export paywall', 'Files stay on your device']

const html = `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url("${interUrl}") format("woff2"); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: Inter, sans-serif; color: #fff; overflow: hidden;
  background: radial-gradient(circle at 12% 18%, rgba(122,90,248,.55), transparent 45%),
              radial-gradient(circle at 92% 88%, rgba(236,72,153,.35), transparent 45%),
              radial-gradient(circle at 80% 10%, rgba(34,211,238,.18), transparent 40%), #0b0b1a; }
.grid { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.08) 1.5px, transparent 1.5px); background-size: 28px 28px; }
.wrap { position: relative; height: 100%; padding: 72px 80px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 20px; font-size: 44px; font-weight: 800; letter-spacing: -1px; }
.logo { width: 76px; height: 76px; filter: drop-shadow(0 12px 30px rgba(105,56,239,.6)); }
.grad { background: linear-gradient(90deg, #9b8afb, #e879f9 50%, #38bdf8); -webkit-background-clip: text; color: transparent; }
h1 { margin-top: 56px; font-size: 76px; line-height: 1.02; font-weight: 800; letter-spacing: -2.5px; max-width: 900px; }
.pills { margin-top: auto; display: flex; gap: 12px; }
.pill { display: flex; align-items: center; gap: 10px; padding: 10px 20px 10px 11px; border-radius: 999px; font-size: 21px; font-weight: 600; white-space: nowrap;
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); }
.dot { width: 30px; height: 30px; border-radius: 999px; background: #10b981; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(16,185,129,.45); }
.url { position: absolute; right: 80px; top: 92px; font-size: 26px; font-weight: 600; color: rgba(255,255,255,.7); }
</style></head><body><div class="grid"></div><div class="wrap">
  <div class="brand"><div class="logo">${logo}</div><span>TrueFree<span class="grad">PDF</span></span></div>
  <div class="url">truefreepdf.com</div>
  <h1>The PDF editor that's <span class="grad">actually free.</span></h1>
  <div class="pills">${promises.map((p) => `<div class="pill"><span class="dot">${check}</span>${p}</div>`).join('')}</div>
</div></body></html>`

// Prefer the system Chrome so no separate browser download is needed.
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(root, 'public', 'og-image.png') })
} finally {
  await browser.close()
}
console.log('Wrote public/og-image.png')
