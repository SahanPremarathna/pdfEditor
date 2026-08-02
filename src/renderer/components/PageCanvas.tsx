import { RenderingCancelledException } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../core/renderPdf'
import { renderPageToCanvas } from '../core/renderPdf'

interface PageCanvasProps {
  pdfDoc: PDFDocumentProxy
  pageNumber: number // 1-indexed, per pdf.js convention
  widthPt: number
  heightPt: number
  scale: number // CSS px per PDF point
  active: boolean
}

export default function PageCanvas({
  pdfDoc,
  pageNumber,
  widthPt,
  heightPt,
  scale,
  active
}: PageCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runIdRef = useRef(0)
  const displayWidth = widthPt * scale
  const displayHeight = heightPt * scale
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active || !canvasRef.current) return undefined

    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const myRunId = ++runIdRef.current
    const isStale = (): boolean => runIdRef.current !== myRunId
    let cancelFn: (() => void) | null = null
    setError(null)

    renderPageToCanvas(pdfDoc, pageNumber, canvas, scale * dpr, isStale)
      .then((handle) => {
        if (!handle) return undefined // aborted before render() was ever called — nothing to cancel
        if (isStale()) {
          handle.cancel()
          return undefined
        }
        cancelFn = handle.cancel
        return handle.promise
      })
      .catch((err: unknown) => {
        if (isStale() || err instanceof RenderingCancelledException) return
        console.error(`Failed to render page ${pageNumber}`, err)
        setError(err instanceof Error ? err.message : 'Failed to render page')
      })

    return () => {
      cancelFn?.()
    }
  }, [pdfDoc, pageNumber, scale, active])

  return (
    <div
      className="relative mx-auto mb-4 bg-white shadow"
      style={{ width: displayWidth, height: displayHeight }}
    >
      {active ? (
        <canvas
          ref={canvasRef}
          style={{ width: displayWidth, height: displayHeight, display: 'block' }}
        />
      ) : (
        <div className="h-full w-full bg-slate-200" />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-2 text-center text-xs text-red-700">
          Page {pageNumber} failed to render: {error}
        </div>
      )}
    </div>
  )
}
