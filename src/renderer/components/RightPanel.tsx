import { FormInput } from 'lucide-react'
import { useState } from 'react'
import { useFormStore } from '../store/formStore'
import { useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'
import FormsPanel from './FormsPanel'
import PropertiesPanel from './PropertiesPanel'
import WatermarkPanel from './WatermarkPanel'

/** Watermark panel takes top priority — opening it is an explicit user
 *  action (the TopBar toggle) that shouldn't be silently pre-empted by a
 *  leftover `selectedId`, and its drag handler never touches
 *  `objectStore.selectedId`, so there's no risk of it flipping unexpectedly
 *  while the panel is open. Object selection and form-filling are otherwise
 *  mutually exclusive by nature — matching PropertiesPanel's own existing
 *  "render nothing until there's something to show" convention one level up.
 *  Rendered as a floating card over the page area (see App). */
export default function RightPanel(): JSX.Element | null {
  const isWatermarkPanelOpen = useUiStore((s) => s.isWatermarkPanelOpen)
  const selectedId = useObjectStore((s) => s.selectedId)
  const fieldCount = useFormStore((s) => s.fields.length)
  // Starts collapsed on phones, where an open panel would cover the page.
  const [formsCollapsed, setFormsCollapsed] = useState(() => window.matchMedia?.('(max-width: 767px)').matches ?? false)

  if (isWatermarkPanelOpen) return <WatermarkPanel />
  if (selectedId) return <PropertiesPanel />
  if (fieldCount === 0) return null
  if (formsCollapsed) {
    return (
      <button type="button" onClick={() => setFormsCollapsed(false)} className="glass btn pointer-events-auto rounded-2xl">
        <FormInput size={15} className="text-ink-500" /> Form fields · {fieldCount}
      </button>
    )
  }
  return <FormsPanel onClose={() => setFormsCollapsed(true)} />
}
