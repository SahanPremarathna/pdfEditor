# TrueFreePDF — the PDF editor that's actually free

**Live at [truefreepdf.com](https://truefreepdf.com)**

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

TrueFreePDF has no paywall, no export limits, no watermark on your files and no account. It's funded by voluntary donations on **Ko-fi**. The app asks gently and rarely:
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
- **Netlify:** *Site configuration → Environment variables*, then redeploy.

If no valid Ko-fi link is available, the donate buttons fall back to "Share TrueFreePDF".

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run typecheck
npm run test:e2e     # builds, serves and drives the app in Chrome
```

## Build

```bash
npm run build        # static site in dist/
npm run preview      # check it locally at http://localhost:4173
```

## Deploy to truefreepdf.com (Netlify)

`netlify.toml` already sets the build command, the `dist/` folder, security and cache headers, and a `www` → apex redirect.

1. **Push the repo to GitHub.**
2. **Create the site in Netlify:** *Add new site → Import an existing project → GitHub*, then pick this repo. Leave the build settings as they are (`netlify.toml` supplies them) and deploy. You'll get a temporary `*.netlify.app` address; check that it works.
3. **Add the domain:** *Domain management → Add a domain → `truefreepdf.com`*. Add `www.truefreepdf.com` too, and make **`truefreepdf.com` the primary domain**.
4. **Point DNS at Netlify.** Pick **one** of these at the registrar where you bought the domain:
   - **Easiest: use Netlify DNS.** In Netlify choose *Set up Netlify DNS*, then at your registrar replace the nameservers with the four Netlify shows (`dns1.p0X.nsone.net` …).
   - **Keep your registrar's DNS:** add these records:

     | Type | Name | Value |
     |---|---|---|
     | `A` | `@` | `75.2.60.5` |
     | `CNAME` | `www` | `<your-site-name>.netlify.app` |

   DNS changes can take anywhere from a few minutes to 24–48 hours to spread.
5. **HTTPS:** Netlify issues a free Let's Encrypt certificate once DNS resolves. Check it under *Domain management → HTTPS*, and turn on *Force HTTPS* if it isn't already. Offline mode and "Install app" need HTTPS.

After that, every push to `main` redeploys automatically. `.github/workflows/ci.yml` separately runs the typecheck, tests and build on each push and pull request.

To regenerate the social-preview image (`public/og-image.png`, shown when the link is shared) after changing the branding, run `node scripts/generate-og-image.mjs`. For the app icons, run `node scripts/generate-web-icons.mjs`.

## Desktop build (optional)

The original Electron shell still works: `npm run dev:desktop`, and `npm run build:win` for the Windows installer.

## Notes

- Everything is bundled and nothing is loaded from a CDN. This includes the pdf.js data (CMaps, standard fonts, image decoders) and the Noto fonts in `public/fonts/`, which are under the SIL Open Font License (`public/fonts/OFL.txt`).
- Sinhala and Tamil text is embedded with Noto Sans Sinhala and Noto Sans Tamil. fontkit's shaping of some complex conjuncts is simplified, and the editor flags this on affected text.
