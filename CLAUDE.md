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
