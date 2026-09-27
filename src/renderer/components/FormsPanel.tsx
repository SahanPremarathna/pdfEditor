import { FormInput } from 'lucide-react'
import { useState } from 'react'
import { useFormStore } from '../store/formStore'
import type { FormField } from '../../shared/types'
import PanelShell from './PanelShell'

interface FieldRowProps {
  field: FormField
}

function FieldRow({ field }: FieldRowProps): JSX.Element {
  const updateFieldValue = useFormStore((s) => s.updateFieldValue)
  const disabled = field.readOnly

  const label = (
    <span className="field-label flex items-center gap-1 normal-case tracking-normal">
      <span className="truncate" title={field.name}>
        {field.name}
      </span>
      {field.required && <span className="text-rose-500">*</span>}
      {field.readOnly && <span className="ml-auto text-[10px] uppercase text-slate-400">read-only</span>}
    </span>
  )

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2.5 rounded-xl bg-slate-900/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
        <input
          type="checkbox"
          checked={field.checked}
          disabled={disabled}
          onChange={(e) => updateFieldValue(field.name, { checked: e.target.checked })}
          className="checkbox"
        />
        {label}
      </label>
    )
  }

  return (
    <label className="flex flex-col gap-1.5">
      {label}

      {field.type === 'text' &&
        (field.multiline ? (
          <textarea
            value={field.value}
            disabled={disabled}
            maxLength={field.maxLength ?? undefined}
            onChange={(e) => updateFieldValue(field.name, { value: e.target.value })}
            className="input textarea"
            rows={3}
          />
        ) : (
          <input
            type="text"
            value={field.value}
            disabled={disabled}
            maxLength={field.maxLength ?? undefined}
            onChange={(e) => updateFieldValue(field.name, { value: e.target.value })}
            className="input"
          />
        ))}

      {(field.type === 'dropdown' || field.type === 'optionList') && (
        <select
          multiple={field.multiselect}
          disabled={disabled}
          value={field.multiselect ? field.selected : (field.selected[0] ?? '')}
          onChange={(e) =>
            updateFieldValue(field.name, {
              selected: field.multiselect ? Array.from(e.target.selectedOptions, (o) => o.value) : [e.target.value]
            })
          }
          className={`input ${field.multiselect ? 'h-auto py-1.5' : ''}`}
        >
          {!field.multiselect && <option value="" />}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {field.type === 'radioGroup' && (
        <div className="flex flex-col gap-1 rounded-xl bg-slate-900/[0.03] p-2 dark:bg-white/[0.04]">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 px-1 py-0.5 text-sm">
              <input
                type="radio"
                name={field.name}
                checked={field.selected === option}
                disabled={disabled}
                onChange={() => updateFieldValue(field.name, { selected: option })}
                className="checkbox"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {field.type === 'button' && <span className="text-xs text-slate-400">Push button — no value to fill</span>}
    </label>
  )
}

export default function FormsPanel({ onClose }: { onClose?: () => void }): JSX.Element {
  const fields = useFormStore((s) => s.fields)
  const [query, setQuery] = useState('')
  const filtered = query ? fields.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())) : fields

  return (
    <PanelShell title={`Form fields · ${fields.length}`} icon={<FormInput size={15} />} onClose={onClose}>
      {fields.length > 6 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter fields…" className="input" />
      )}
      {filtered.map((field) => (
        <FieldRow key={field.name} field={field} />
      ))}
      {filtered.length === 0 && <p className="text-sm text-slate-500">No fields match “{query}”.</p>}
    </PanelShell>
  )
}
