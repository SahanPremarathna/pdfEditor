import { useEffect, useState } from 'react'

/** Loads a data URL into an HTMLImageElement for Konva's <Image> (which needs
 *  a decoded image element, not a raw data URL string). No `use-image`
 *  dependency is installed, so this is a small hand-rolled equivalent. */
export function useHtmlImage(dataUrl: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setImage(img)
    img.src = dataUrl
    return () => {
      img.onload = null
    }
  }, [dataUrl])

  return image
}
