/** Converts a `file:` URL to a native path — `/E:/a%20b/c` → `E:/a b/c` on
 *  Windows drive paths, `/home/x` stays `/home/x`. Pure string work, so the
 *  renderer never needs Node's `url` module. */
export function fileUrlToPath(url: URL): string {
  if (url.protocol !== 'file:') throw new Error(`Not a file URL: ${url.href}`)
  const pathname = decodeURIComponent(url.pathname)
  const unc = url.host ? `//${url.host}` : ''
  return /^\/[A-Za-z]:/.test(pathname) ? pathname.slice(1) : unc + pathname
}
