/** Decodes a `data:<mime>;base64,<...>` string into raw bytes, for handing
 *  to pdf-lib's embedPng/embedJpg. Uses the browser's `atob` global — no
 *  Node Buffer, so this stays renderer-safe (no fs/path/electron import). */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    throw new Error('Invalid data URL: missing base64 payload')
  }
  const base64 = dataUrl.slice(commaIndex + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
