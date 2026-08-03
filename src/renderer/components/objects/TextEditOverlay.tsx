import { useEffect, useRef, useState } from 'react'
import { ptToPx } from '../../core/coords'
import { fontFamilyToCss } from '../../core/fontFamilies'
import { useObjectStore } from '../../store/objectStore'
import type { TextObject } from '../../../shared/types'

interface TextEditOverlayProps {
  obj: TextObject
  scale: number
}

/**
 * Konva renders to a <canvas> and has no native text input, so inline
 * editing is done with a plain HTML <textarea> positioned as a DOM sibling
 * over the (hidden) Konva Text node. Position/size here are dynamically
 * computed geometry, an explicit exception to the no-inline-style rule.
 */
export default function TextEditOverlay({ obj, scale }: TextEditOverlayProps): JSX.Element {
  const updateObject = useObjectStore((s) => s.updateObject)
  const removeObject = useObjectStore((s) => s.removeObject)
  const stopEditing = useObjectStore((s) => s.stopEditing)

  const [draft, setDraft] = useState(obj.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    // Deferred via setTimeout(0), not called synchronously: the mousedown
    // that creates this object is still being processed by the browser
    // (mouseup/click for the same gesture haven't fired yet), and calling
    // focus() immediately loses a race with that trailing native event
    // processing, which blurs it right back out (observed as an immediate
    // blur with relatedTarget null). Deferring past the current task avoids it.
    const timer = setTimeout(() => {
      el.focus()
      el.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const commit = (): void => {
    if (draft.trim() === '') {
      // avoid stranding an invisible empty text object after "place then click away"
      removeObject(obj.pageIndex, obj.id)
    } else {
      updateObject(obj.pageIndex, obj.id, { text: draft })
    }
    stopEditing()
  }

  const discard = (): void => {
    stopEditing()
  }

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          discard()
        }
      }}
      className="absolute resize-none border border-dashed border-slate-400 bg-white/90 p-0 outline-none"
      style={{
        left: ptToPx(obj.x, scale),
        top: ptToPx(obj.y, scale),
        width: ptToPx(obj.width, scale),
        height: ptToPx(obj.height, scale),
        fontSize: ptToPx(obj.fontSize, scale),
        fontFamily: fontFamilyToCss(obj.fontFamily),
        fontWeight: obj.bold ? 'bold' : 'normal',
        fontStyle: obj.italic ? 'italic' : 'normal',
        color: obj.color,
        textAlign: obj.align,
        lineHeight: obj.lineHeight,
        opacity: obj.opacity,
        transform: `rotate(${obj.rotation}deg)`,
        transformOrigin: 'top left'
      }}
    />
  )
}
