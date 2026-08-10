/**
 * Finds the first argv entry that looks like a launched .pdf path — used for
 * both the initial `process.argv` (cold start via file association / "Open
 * with") and a `second-instance` event's argv (already-running app, user
 * opens another .pdf). Scans rather than indexing a fixed position: a
 * packaged app's argv is `[exePath, filePath]`, but the unpackaged/dev argv
 * additionally carries Electron's own flags and the entry-script path first
 * — a fixed index would pick the wrong element (or throw) in one of the two
 * shapes.
 */
export function findLaunchPdfPath(argv: string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().endsWith('.pdf')) ?? null
}
