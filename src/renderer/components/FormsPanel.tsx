import { useFormStore } from '../store/formStore'
import type { FormField } from '../../shared/types'

interface FieldRowProps {
  field: FormField
}

function FieldRow({ field }: FieldRowProps): JSX.Element {
  const updateFieldValue = useFormStore((s) => s.updateFieldValue)
  const disabled = field.readOnly

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">
        {field.name}
        {field.required && ' *'}
      </span>

      {field.type === 'text' &&
        (field.multiline ? (
          <textarea
            value={field.value}
            disabled={disabled}
            maxLength={field.maxLength ?? undefined}
            onChange={(e) => updateFieldValue(field.name, { value: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            rows={3}
          />
        ) : (
          <input
            type="text"
            value={field.value}
            disabled={disabled}
            maxLength={field.maxLength ?? undefined}
            onChange={(e) => updateFieldValue(field.name, { value: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          />
        ))}

      {field.type === 'checkbox' && (
        <input
          type="checkbox"
          checked={field.checked}
          disabled={disabled}
          onChange={(e) => updateFieldValue(field.name, { checked: e.target.checked })}
          className="h-4 w-4"
        />
      )}

      {(field.type === 'dropdown' || field.type === 'optionList') && (
        <select
          multiple={field.multiselect}
          disabled={disabled}
          value={field.multiselect ? field.selected : (field.selected[0] ?? '')}
          onChange={(e) =>
            updateFieldValue(field.name, {
              selected: field.multiselect
                ? Array.from(e.target.selectedOptions, (o) => o.value)
                : [e.target.value]
            })
          }
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
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
        <div className="flex flex-col gap-1">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name={field.name}
                checked={field.selected === option}
                disabled={disabled}
                onChange={() => updateFieldValue(field.name, { selected: option })}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {field.type === 'button' && <span className="text-xs text-slate-400">(button — no value)</span>}
    </label>
  )
}

export default function FormsPanel(): JSX.Element {
  const fields = useFormStore((s) => s.fields)

  return (
    <div className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 text-sm">
      <h2 className="font-semibold text-slate-700">Form fields</h2>
      {fields.map((field) => (
        <FieldRow key={field.name} field={field} />
      ))}
    </div>
  )
}
