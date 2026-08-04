import { create } from 'zustand'
import { useDocumentStore } from './documentStore'
import type { FormField } from '../../shared/types'

/**
 * `value`/`checked` are unambiguous, but `selected` means `string[]` on
 * DropdownFormField/OptionListFormField and `string | null` on
 * RadioGroupFormField — the same name-with-different-type trap
 * objectStore.ts's PdfObjectPatch already works around, hand-listed here for
 * the same reason (a Partial<FormField> would collapse `selected` to the
 * narrower common type and silently drop `null`).
 */
export interface FormFieldPatch {
  value?: string
  checked?: boolean
  selected?: string[] | string | null
}

interface FormState {
  fields: FormField[]
  setFields: (fields: FormField[]) => void
  /** Deliberately NOT routed through the undo/redo stack — filling a form
   *  isn't a drawing operation, and there's no product expectation that
   *  Ctrl+Z should revert a form keystroke the way it reverts a shape drag. */
  updateFieldValue: (name: string, patch: FormFieldPatch) => void
  reset: () => void
}

export const useFormStore = create<FormState>((set, get) => ({
  fields: [],

  setFields: (fields) => set({ fields }),

  updateFieldValue: (name, patch) => {
    const fields = get().fields
    const target = fields.find((f) => f.name === name)
    if (!target || target.readOnly) return

    // The merge always preserves `f.type` (patch never includes it), so the
    // result is still a valid member of the original field's own union
    // branch — just not something TS can prove structurally from a widened
    // patch bag, hence the cast (same pattern as objectStore.ts).
    set({ fields: fields.map((f) => (f.name === name ? ({ ...f, ...patch } as FormField) : f)) })
    useDocumentStore.getState().markDirty()
    window.api.notifyDirty(true)
  },

  reset: () => set({ fields: [] })
}))
