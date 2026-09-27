import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts (the web build, rooted at src/renderer)
// so test discovery stays rooted at the repo and no PWA plugin runs in tests.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts']
  }
})
