import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { readFormFields } from './formFields'
import type { CheckBoxFormField, DropdownFormField, RadioGroupFormField, TextFormField } from '../../shared/types'

async function buildFixtureBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  const form = doc.getForm()

  const text = form.createTextField('name')
  text.setText('Ada')
  text.addToPage(page, { x: 10, y: 10, width: 100, height: 20 })

  const checkbox = form.createCheckBox('subscribe')
  checkbox.check()
  checkbox.addToPage(page, { x: 10, y: 40, width: 20, height: 20 })

  const dropdown = form.createDropdown('country')
  dropdown.addOptions(['US', 'CA', 'UK'])
  dropdown.select('CA')
  dropdown.addToPage(page, { x: 10, y: 70, width: 100, height: 20 })

  const radioGroup = form.createRadioGroup('plan')
  radioGroup.addOptionToPage('basic', page, { x: 10, y: 100, width: 20, height: 20 })
  radioGroup.addOptionToPage('pro', page, { x: 40, y: 100, width: 20, height: 20 })
  radioGroup.select('pro')

  const button = form.createButton('submit')
  button.addToPage('Submit', page, { x: 10, y: 130, width: 60, height: 20 })

  return doc.save()
}

describe('readFormFields', () => {
  it('reads one of each field type into plain-data FormField shapes', async () => {
    const bytes = await buildFixtureBytes()
    const fields = await readFormFields(bytes)

    expect(fields).toHaveLength(5)

    const text = fields.find((f) => f.name === 'name') as TextFormField
    expect(text.type).toBe('text')
    expect(text.value).toBe('Ada')
    expect(text.readOnly).toBe(false)

    const checkbox = fields.find((f) => f.name === 'subscribe') as CheckBoxFormField
    expect(checkbox.type).toBe('checkbox')
    expect(checkbox.checked).toBe(true)

    const dropdown = fields.find((f) => f.name === 'country') as DropdownFormField
    expect(dropdown.type).toBe('dropdown')
    expect(dropdown.options).toEqual(['US', 'CA', 'UK'])
    expect(dropdown.selected).toEqual(['CA'])

    const radioGroup = fields.find((f) => f.name === 'plan') as RadioGroupFormField
    expect(radioGroup.type).toBe('radioGroup')
    expect(radioGroup.options.sort()).toEqual(['basic', 'pro'])
    expect(radioGroup.selected).toBe('pro')

    const button = fields.find((f) => f.name === 'submit')
    expect(button?.type).toBe('button')
  })

  it('returns an empty array for a document with no AcroForm', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([300, 300])
    const bytes = await doc.save()

    expect(await readFormFields(bytes)).toEqual([])
  })
})
