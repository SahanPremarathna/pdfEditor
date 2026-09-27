# Inkline — working agreement

## Commands
- `npm run dev` — web app (Vite) with HMR at http://localhost:5173
- `npm run build` — static web build to /dist (PWA, deployable anywhere)
- `npm run preview` — serve /dist locally at http://localhost:4173
- `npm run typecheck` — tsc --noEmit, must be clean before any commit
- `npm run test` — vitest
- `npm run test:e2e` — Playwright against the production build (uses installed Chrome)
- `npm run dev:desktop` / `npm run build:win` — Electron shell; NSIS installer to /release

## Rules
- TypeScript strict. No `any`. No non-null `!` without a comment justifying it.
- The renderer NEVER imports `fs`, `path`, or `electron`. Host access (open/save/recent files) goes through `platform()` from `src/renderer/platform` only — Electron's `window.api` or the browser implementation in `platform/web.ts`.
- All geometry conversion lives in `src/renderer/core/coords.ts`. Nowhere else.
- Every edit action goes through the history command stack. If it can't be undone, it isn't finished.
- No CDN URLs anywhere. The app must fully work offline.
- Never call the whiteout tool "redaction" in code, comments or UI.
- Prefer small pure functions in `core/` with vitest coverage over logic inside components.

## Style
- Functional components, hooks, no class components.
- zustand stores expose actions, not raw setters.
- Tailwind only; no inline style objects except for dynamically computed geometry.
