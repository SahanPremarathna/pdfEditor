export interface LoadedImage {
  dataUrl: string
  mime: 'image/png' | 'image/jpeg'
  width: number // natural pixel width
  height: number // natural pixel height
}

function toSupportedMime(mime: string): 'image/png' | 'image/jpeg' {
  return mime === 'image/jpeg' || mime === 'image/jpg' ? 'image/jpeg' : 'image/png'
}

/**
 * Reads a File (from a file picker, paste, or drag-drop — all DOM APIs, no
 * fs/path/electron import) into a data URL plus its natural pixel size.
 * Shared by every image-acquisition path so they stay in sync.
 */
export function readImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'))
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to decode image file'))
      img.onload = () => {
        resolve({ dataUrl, mime: toSupportedMime(file.type), width: img.naturalWidth, height: img.naturalHeight })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

/** Fits a natural pixel size within a max on-screen dimension (points),
 *  preserving aspect ratio, for sizing a newly-placed ImageObject. */
export function fitWithinMaxDimension(
  naturalWidth: number,
  naturalHeight: number,
  maxDimensionPt: number
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: maxDimensionPt, height: maxDimensionPt }
  }
  const scale = Math.min(1, maxDimensionPt / Math.max(naturalWidth, naturalHeight))
  return { width: naturalWidth * scale, height: naturalHeight * scale }
}
