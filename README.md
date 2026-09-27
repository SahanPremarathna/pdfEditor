# Inkline — PDF editor for the web

Edit, sign, annotate and rearrange PDFs in the browser. Files are processed entirely on the user's device: nothing is uploaded, there's no backend, and the app works offline once it has loaded (it's an installable PWA).

## Features

- **Add content:** text (any language or symbol, embedded with bundled Noto fonts), images (picker, paste or drop), and vector signatures drawn with mouse, finger or stylus.
- **Mark up:** rectangles, ellipses, lines, arrows, freehand drawing, highlight, and whiteout. Whiteout only covers content visually; the text underneath is still in the file.
- **Forms:** fill AcroForm text fields, checkboxes, dropdowns, lists and radio groups, and optionally flatten them on save.
- **Watermark:** text or image, applied to any page range.
- **Pages:** reorder by drag, rotate, delete, duplicate, insert blank pages (Letter or A4) or pages from another PDF, and extract pages to a new PDF.
- **Editing:** full undo/redo, keyboard shortcuts (press `?`), arrow-key nudge, duplicate, and Ctrl+wheel zoom.
- **Files:** in Chromium browsers Save writes back to the original file; other browsers download the result. Recent files are kept locally in IndexedDB.
- **Password-protected PDFs** can be unlocked for viewing and annotating. Saving encrypted files isn't supported.
- **UI:** light and dark themes, and a responsive layout that works on phones and tablets.

## Free forever, supported by donations

Inkline has no paywall, no export limits, no watermark on your files and no account. It's funded by voluntary donations on **Ko-fi**. The app asks gently and rarely:
- a **Support** button in the top bar
- a support section on the landing page
- a small thank-you card after a save, at most once a week. It stays quiet for 60 days after someone supports, and has a "Don't show again" option.

It never blocks or delays a save.

Configure it with build-time environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_KOFI_URL` | Optional. Overrides the built-in Ko-fi page (`https://ko-fi.com/sahantp`, set in `src/renderer/config/support.ts`). |
| `VITE_MAKER_NAME` | Optional. Shown as "Made with ♥ by …" and in the support note. |
| `VITE_REPO_URL` | Optional. A public repo link that adds a "Star on GitHub" option. |

Where to set them:
- **Local:** create `.env.local`.
- **Netlify or Vercel:** add them in the site's environment variables.
- **GitHub Pages:** add them under *Settings → Secrets and variables → Actions → Variables*.

If no valid Ko-fi link is available, the donate buttons fall back to "Share Inkline".

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run typecheck
npm run test:e2e     # builds, serves and drives the app in Chrome
```

## Build and host

```bash
npm run build        # static site in dist/
npm run preview      # check it locally at http://localhost:4173
```

`dist/` is a plain static site, so any static host can serve it. The repo includes ready-made configs:

| Host | How |
|---|---|
| **Netlify** | Connect the repo. `netlify.toml` sets the build command, `dist/` and the headers. |
| **Vercel** | Import the repo. `vercel.json` sets the build, output and headers. |
| **GitHub Pages** | Settings → Pages → Source: *GitHub Actions*. `.github/workflows/deploy-pages.yml` builds with the right base path on every push to `main`. |
| **Anything else** | Upload `dist/`. To serve from a sub-path, build with `VITE_BASE=/sub/path/ npm run build`. |

Serve it over HTTPS (every host above does this). Service workers, and with them offline mode and install, only work on HTTPS or `localhost`.

## Desktop build (optional)

The original Electron shell still works: `npm run dev:desktop`, and `npm run build:win` for the Windows installer.

## Notes

- Everything is bundled and nothing is loaded from a CDN. This includes the pdf.js data (CMaps, standard fonts, image decoders) and the Noto fonts in `public/fonts/`, which are under the SIL Open Font License (`public/fonts/OFL.txt`).
- Sinhala and Tamil text is embedded with Noto Sans Sinhala and Noto Sans Tamil. fontkit's shaping of some complex conjuncts is simplified, and the editor flags this on affected text.
