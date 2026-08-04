import { useFormStore } from '../store/formStore'
import { useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'
import FormsPanel from './FormsPanel'
import PropertiesPanel from './PropertiesPanel'
import WatermarkPanel from './WatermarkPanel'

/** Watermark panel takes top priority — opening it is an explicit user
 *  action (the Toolbar toggle) that shouldn't be silently pre-empted by a
 *  leftover `selectedId`, and its drag handler never touches
 *  `objectStore.selectedId`, so there's no risk of it flipping unexpectedly
 *  while the panel is open. Object selection and form-filling are otherwise
 *  mutually exclusive by nature — matching PropertiesPanel's own existing
 *  "render nothing until there's something to show" convention one level up. */
export default function RightPanel(): JSX.Element | null {
  const isWatermarkPanelOpen = useUiStore((s) => s.isWatermarkPanelOpen)
  const selectedId = useObjectStore((s) => s.selectedId)
  const hasFields = useFormStore((s) => s.fields.length > 0)

  if (isWatermarkPanelOpen) return <WatermarkPanel />
  if (selectedId) return <PropertiesPanel />
  if (hasFields) return <FormsPanel />
  return null
}
