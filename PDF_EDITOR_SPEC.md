# PDF Editor — Build Spec for Claude Code

> Drop this file in an empty folder, open the folder in VS Code, run `claude`, and work through the phases at the bottom **one at a time**.

---

## 0. What we are building

A cross-platform **desktop PDF editor** (Windows first) that opens a real PDF, lets the user place text, images, shapes, highlights, whiteout and signatures directly on the pages, reorder/rotate/delete pages, and save the result back to a real `.pdf` file on disk.

**Product name:** `Inkline` (rename freely)

### Honest scope boundary — read this first

PDFs do not store paragraphs. They store positioned glyphs using embedded, often subsetted, fonts. There is no reliable "click the existing sentence and retype it" without reconstructing text runs and re-embedding fonts — that is what makes Acrobat expensive.

So v1 does this:

| Capability | v1 | Notes |
|---|---|---|
| Add new text, images, shapes, highlights, signatures | ✅ | Real PDF content, not a screenshot |
| Cover existing content (whiteout box) and type over it | ✅ | This is how ~90% of real-world "editing" gets done |
| Move / resize / rotate / restyle **your own** objects | ✅ | Full editing until saved |
| Page ops: rotate, delete, reorder, insert, merge, split | ✅ | |
| Fill existing AcroForm fields | ✅ | `pdf-lib` `getForm()` |
| Click and retype **existing** text in place | ❌ v1 | See §9 for the v2 path |
| OCR scanned PDFs | ❌ v1 | |
| True redaction (removing bytes, not covering them) | ❌ v1 | Whiteout is visual only — say so in the UI |

Do not let the whiteout tool be called "redact" anywhere in the UI. It hides pixels; the text is still extractable. Mislabelling that is a security bug.

---

## 1. Stack (fixed — do not substitute)

| Layer | Choice | Why |
|---|---|---|
| Shell | **Electron 31+** | Needs real filesystem access to save to PC |
| Scaffold | **electron-vite** | Fast HMR, sane main/preload/renderer split |
| UI | **React 18 + TypeScript (strict)** | |
| Styling | **Tailwind CSS** | |
| Rendering | **pdfjs-dist** | Apache-2.0, renders any PDF to canvas |
| Writing | **pdf-lib** + **@pdf-lib/fontkit** | MIT, writes real PDF operators |
| Canvas overlay | **react-konva** | Built-in Transformer = drag/resize/rotate for free |
| State | **zustand** | |
| Packaging | **electron-builder** | NSIS installer for Windows |
| Tests | **vitest** (unit) + **@playwright/test** (e2e smoke) | |

### Licensing note (matters if this is ever sold)
`pdf.js` is Apache-2.0 and `pdf-lib` is MIT — both fine for a closed-source commercial product. **MuPDF / PyMuPDF / mupdf.js are AGPL-3.0** and would force you to open-source the whole app or buy a commercial licence from Artifex. Do not pull them in without a deliberate decision.

---

## 2. Project structure

```
inkline/
├── electron.vite.config.ts
├── package.json
├── CLAUDE.md                      # conventions (see §10)
├── PDF_EDITOR_SPEC.md             # this file
├── src/
│   ├── main/                      # Node — owns the filesystem
│   │   ├── index.ts               # BrowserWindow, app lifecycle, menu
│   │   ├── ipc/
│   │   │   ├── fileHandlers.ts    # open/save/saveAs dialogs + fs
│   │   │   └── recentFiles.ts     # electron-store
│   │   └── menu.ts                # native menu + accelerators
│   ├── preload/
│   │   └── index.ts               # contextBridge → window.api (typed)
│   ├── shared/
│   │   ├── types.ts               # IPC contract + domain types, imported by both sides
│   │   └── channels.ts            # string constants for IPC channel names
│   └── renderer/
│       ├── App.tsx
│       ├── core/
│       │   ├── coords.ts          # ⚠ THE critical module — see §4
│       │   ├── renderPdf.ts       # pdf.js page → canvas
│       │   ├── exportPdf.ts       # objects + original bytes → new PDF bytes
│       │   ├── fonts.ts           # font registry + embedding
│       │   └── history.ts         # undo/redo command stack
│       ├── store/
│       │   ├── documentStore.ts   # loaded doc, pages, dirty flag
│       │   ├── objectStore.ts     # edit objects, selection
│       │   └── uiStore.ts         # active tool, zoom, sidebar
│       ├── components/
│       │   ├── Toolbar.tsx
│       │   ├── PageCanvas.tsx     # pdf.js canvas + Konva Stage stacked
│       │   ├── PageList.tsx       # virtualized scroll of PageCanvas
│       │   ├── ThumbnailRail.tsx  # drag-to-reorder pages
│       │   ├── PropertiesPanel.tsx
│       │   └── objects/           # TextObject, ImageObject, ShapeObject...
│       └── hooks/
└── resources/
    └── fonts/                     # bundled TTFs (see §6)
```

---

## 3. Data model

`src/shared/types.ts`:

```ts
export type ObjectType =
  | 'text' | 'image' | 'freehand' | 'rect' | 'ellipse'
  | 'line' | 'arrow' | 'highlight' | 'whiteout' | 'signature';

/** All geometry in PDF POINTS, origin TOP-LEFT of the page CropBox. */
export interface BaseObject {
  id: string;
  pageIndex: number;
  type: ObjectType;
  x: number; y: number;          // top-left of bounding box, points
  width: number; height: number; // points
  rotation: number;              // degrees clockwise
  opacity: number;               // 0..1
  z: number;
  locked: boolean;
}

export interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  fontFamily: string;            // key into the font registry
  fontSize: number;              // points
  color: string;                 // #rrggbb
  bold: boolean; italic: boolean;
  align: 'left' | 'center' | 'right';
  lineHeight: number;            // multiplier, default 1.2
}

export interface ImageObject extends BaseObject {
  type: 'image';
  dataUrl: string;               // in-memory only
  mime: 'image/png' | 'image/jpeg';
}

export interface PathObject extends BaseObject {
  type: 'freehand' | 'line' | 'arrow';
  points: number[];              // flat [x,y,x,y,...] relative to x,y
  stroke: string; strokeWidth: number;
}

export interface ShapeObject extends BaseObject {
  type: 'rect' | 'ellipse' | 'highlight' | 'whiteout';
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
}

export interface PageMeta {
  index: number;
  widthPt: number;   // CropBox width AFTER applying /Rotate
  heightPt: number;
  rotation: 0 | 90 | 180 | 270;  // user-applied delta, not the original
  deleted: boolean;
}
```

Store objects in **points with a top-left origin** because that matches the UI mental model. Convert to PDF user space exactly once, in `exportPdf.ts`. Never convert anywhere else.

---

## 4. ⚠ Coordinate system — the #1 source of bugs

Build `src/renderer/core/coords.ts` **first**, with tests, before any UI. Every "my text saved 40px too low" bug traces back to this file.

Facts:
- PDF user space: origin **bottom-left**, y grows **up**, unit = 1 point = 1/72 inch.
- Canvas/DOM: origin **top-left**, y grows **down**, unit = CSS pixel.
- Use **CropBox**, not MediaBox, for visible page size — they differ in print-prepped files.
- pdf.js `page.getViewport({ scale })` already bakes in `/Rotate`. Use `viewport.width/height`, never raw MediaBox.
- `pdf-lib`'s `drawText(text, { x, y })` places the **baseline**, not the top of the glyph box.

```ts
// screen px → points (top-left origin)
export const pxToPt = (px: number, scale: number) => px / scale;

// points (top-left origin) → PDF user space (bottom-left origin)
export function toPdfSpace(
  x: number, y: number, height: number, pageHeightPt: number
) {
  return { x, y: pageHeightPt - y - height };
}

// text baseline: y_pdf points to the baseline, so drop by the ascent
export function textBaselineY(
  yTopPt: number, pageHeightPt: number, font: PDFFont, fontSize: number
) {
  const ascent = font.heightAtSize(fontSize) * 0.8; // refine per font metrics
  return pageHeightPt - yTopPt - ascent;
}
```

**Acceptance test for this module:** place a 12pt text object at exactly (72, 72) top-left on an A4 page, export, reopen the exported file in the app, and confirm it renders at (72, 72) ±0.5pt. Also verify on a page with `/Rotate 90` and on a page whose CropBox ≠ MediaBox. Do not proceed to Phase 3 until this passes.

---

## 5. Rendering architecture

Each page is two stacked layers inside a positioned container:

1. `<canvas>` — pdf.js render of the original page (read-only, re-rendered on zoom change).
2. `<Stage>` (react-konva), same CSS size, transparent — all edit objects, selection, transformer.

Rules:
- Render at `devicePixelRatio * zoom` for crispness; set CSS size separately from the backing-store size.
- Virtualize: only render pages within ~2 viewports of the scroll position. Show a grey placeholder box of the correct aspect ratio for the rest, so scroll height stays stable.
- Cancel in-flight `page.render()` tasks on unmount/zoom change or pdf.js will throw.
- Load the pdf.js worker from a bundled local file, never a CDN — the app must work offline.

---

## 6. Fonts (important for Sri Lanka)

`pdf-lib`'s 14 standard fonts are **WinAnsi only** — they will throw on any character outside Latin-1. Sinhala, Tamil, curly quotes, em dashes and emoji all break.

So:
- Bundle TTFs in `resources/fonts/`: Inter (or Roboto), a serif, a mono, plus **Noto Sans Sinhala** and **Noto Sans Tamil**.
- Always `pdfDoc.registerFontkit(fontkit)` and `embedFont(bytes, { subset: true })`. Subsetting keeps file size sane.
- Build a `fonts.ts` registry mapping `fontFamily` key → TTF path → cached embedded `PDFFont` per export.
- **Known limitation:** fontkit does not do complex-script shaping. Sinhala and Tamil conjuncts/vowel signs will render as unshaped glyph sequences. If proper Sinhala output is needed, that requires `harfbuzzjs` for shaping and drawing pre-shaped glyph runs. Flag this in the UI rather than shipping silently-wrong text.

---

## 7. Main-process / IPC contract

The renderer must never touch `fs`. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

```ts
// src/shared/channels.ts
export const CH = {
  OPEN_DIALOG: 'file:openDialog',
  READ_FILE:   'file:read',
  SAVE:        'file:save',
  SAVE_AS:     'file:saveAs',
  RECENT_GET:  'recent:get',
  RECENT_ADD:  'recent:add',
} as const;
```

```ts
// window.api, exposed via contextBridge
interface Api {
  openDialog(): Promise<{ path: string; bytes: Uint8Array } | null>;
  readFile(path: string): Promise<Uint8Array>;
  save(path: string, bytes: Uint8Array): Promise<void>;
  saveAs(defaultName: string, bytes: Uint8Array): Promise<string | null>;
  getRecent(): Promise<string[]>;
  onMenuAction(cb: (action: string) => void): () => void;
}
```

Security: validate that save paths are absolute and outside the app bundle. Set a CSP. Disable `webSecurity: false`. Block `window.open` and all external navigation.

---

## 8. Export pipeline (`exportPdf.ts`)

```
original bytes
  → PDFDocument.load(bytes, { updateMetadata: false })
  → registerFontkit
  → apply page ops (delete / reorder via copyPages into a fresh doc, rotate via page.setRotation)
  → for each surviving page, for each object sorted by z:
       switch (type) {
         text      → drawText with embedded font, manual line wrapping
         image     → embedPng / embedJpg + drawImage
         rect/etc  → drawRectangle / drawEllipse / drawLine
         highlight → drawRectangle with blendMode Multiply, opacity ~0.4
         whiteout  → opaque white drawRectangle
         freehand  → drawSvgPath from the point list
       }
  → form.flatten() only if "Export flattened" was chosen
  → doc.save() → Uint8Array → IPC → fs.writeFile
```

Details that bite:
- `updateMetadata: false` keeps pdf-lib from stamping its own Producer over the original.
- Deleting/reordering pages: `PDFDocument.create()` then `copyPages` in the new order. Mutating in place is unreliable.
- Rotation on an object: pdf-lib rotates about the **bottom-left** of the drawn item, so pre-translate to rotate about the visual centre.
- Text wrapping is yours to implement — pdf-lib does none. Use `font.widthOfTextAtSize()` and greedy word wrap; break long unbreakable tokens by character.
- Encrypted PDFs: `load(bytes, { ignoreEncryption: true })` can read some, but saving is unreliable. Detect and show a clear "this PDF is password-protected" message instead of producing a corrupt file.

**Save is only correct if the exported file reopens cleanly in Chrome, Edge and Acrobat Reader.** Add that to every phase's acceptance criteria.

---

## 9. v2 path for editing existing text (do not build in v1)

Recorded here so the v1 architecture doesn't block it:
1. `page.getTextContent()` from pdf.js gives per-item text, transform matrix, width and font name.
2. Cluster items into lines/blocks by baseline y and x-gap heuristics.
3. On double-click, whiteout the item's bounding box and spawn a `TextObject` pre-filled with the extracted string, matched to the nearest bundled font.
4. Accept that font matching is approximate — the substitution will be visible on unusual fonts.

This is a convincing 80% solution and it composes cleanly with the v1 object model. That is the point of storing objects the way §3 does.

---

## 10. `CLAUDE.md` to create in the repo root

```markdown
# Inkline — working agreement

## Commands
- `npm run dev` — Electron + Vite with HMR
- `npm run typecheck` — tsc --noEmit, must be clean before any commit
- `npm run test` — vitest
- `npm run build:win` — NSIS installer to /release

## Rules
- TypeScript strict. No `any`. No non-null `!` without a comment justifying it.
- The renderer NEVER imports `fs`, `path`, or `electron`. Filesystem access goes through `window.api` only.
- All geometry conversion lives in `src/renderer/core/coords.ts`. Nowhere else.
- Every edit action goes through the history command stack. If it can't be undone, it isn't finished.
- No CDN URLs anywhere. The app must fully work offline.
- Never call the whiteout tool "redaction" in code, comments or UI.
- Prefer small pure functions in `core/` with vitest coverage over logic inside components.

## Style
- Functional components, hooks, no class components.
- zustand stores expose actions, not raw setters.
- Tailwind only; no inline style objects except for dynamically computed geometry.
```

---

## 11. Build phases

Run **one phase per Claude Code session**. Git commit at the end of each. Do not let it run ahead.

**Phase 0 — Scaffold.** electron-vite + React + TS strict + Tailwind. Blank window, HMR working, `npm run typecheck` clean, `CLAUDE.md` written.
*Done when:* `npm run dev` opens a window showing a styled placeholder.

**Phase 1 — Open and render.** Native open dialog → IPC → bytes → pdf.js → render page 1 to canvas. Zoom in/out/fit-width. Continuous vertical scroll of all pages with virtualization.
*Done when:* a 200-page PDF scrolls smoothly and memory stays flat.

**Phase 2 — Coordinate core.** `coords.ts` + `fonts.ts` + vitest suite. No UI. Include the §4 acceptance test, plus rotated-page and CropBox≠MediaBox cases.
*Done when:* all coordinate tests pass. **Do not skip this phase.**

**Phase 3 — Object layer.** Konva Stage over each page. Text tool: click to place, edit inline, drag/resize/rotate via Transformer. Properties panel for font, size, colour, opacity. Selection, delete, z-order.
*Done when:* text objects can be placed and manipulated on any page. Nothing saves yet.

**Phase 4 — Export.** `exportPdf.ts` for text. Save / Save As / Ctrl+S. Dirty-state guard on close.
*Done when:* placed text survives a save→reopen round-trip at the same coordinates, and the file opens in Acrobat Reader without warnings.

**Phase 5 — Remaining tools.** Image (file picker + paste + drag-drop), rect, ellipse, line, arrow, freehand, highlight, whiteout, signature pad. Each with its own export branch.
*Done when:* every tool round-trips through save→reopen.

**Phase 6 — Undo/redo + page ops.** Command stack wired through every mutation. Thumbnail rail with drag-to-reorder, rotate, delete, insert blank, import pages from another PDF.
*Done when:* 30 mixed operations undo and redo cleanly in order.

**Phase 7 — Forms + polish.** AcroForm field detection and filling, flatten-on-export option, recent files, keyboard shortcuts, native menu, empty/loading/error states, password-protected-PDF detection.

**Phase 8 — Package.** electron-builder, NSIS installer, app icon, file association for `.pdf`, smoke-test the installed build on a clean Windows machine.

---

## 12. Prompts to actually type into Claude Code

```
> Read PDF_EDITOR_SPEC.md end to end. Summarise the architecture back to me
  in 10 bullets and list anything you think is wrong or risky. Do not write code yet.
```

Then, per phase:

```
> Implement Phase 0 only. Follow CLAUDE.md. Stop when the acceptance criterion
  is met and show me the file tree plus any decisions you made that the spec
  didn't cover.
```

```
> Implement Phase 2 only. Write the vitest tests FIRST, show me them, wait for
  my approval, then write coords.ts and fonts.ts until they pass.
```

Useful habits:
- `/init` in the repo first so Claude Code indexes the structure.
- After each phase: `npm run typecheck && npm run test`, then `git commit`.
- If it starts refactoring beyond the phase: `> Revert anything outside Phase N scope.`
- When a save bug appears: `> Write a failing vitest case that reproduces this before fixing it.`
- Keep the context lean — `/clear` between phases, since the spec file carries the memory.
