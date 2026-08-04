import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, type PDFField } from 'pdf-lib'
import type { FormField } from '../../shared/types'

function toFormField(field: PDFField): FormField {
  const base = { name: field.getName(), readOnly: field.isReadOnly(), required: field.isRequired() }

  if (field instanceof PDFTextField) {
    return {
      ...base,
      type: 'text',
      value: field.getText() ?? '',
      multiline: field.isMultiline(),
      maxLength: field.getMaxLength() ?? null
    }
  }
  if (field instanceof PDFCheckBox) {
    return { ...base, type: 'checkbox', checked: field.isChecked() }
  }
  if (field instanceof PDFDropdown) {
    return {
      ...base,
      type: 'dropdown',
      options: field.getOptions(),
      selected: field.getSelected(),
      multiselect: field.isMultiselect()
    }
  }
  if (field instanceof PDFOptionList) {
    return {
      ...base,
      type: 'optionList',
      options: field.getOptions(),
      selected: field.getSelected(),
      multiselect: field.isMultiselect()
    }
  }
  if (field instanceof PDFRadioGroup) {
    return { ...base, type: 'radioGroup', options: field.getOptions(), selected: field.getSelected() ?? null }
  }
  // PDFButton (and PDFSignature, treated the same — neither has a fillable value)
  return { ...base, type: 'button' }
}

/**
 * Reads a PDF's AcroForm fields into plain-data FormField shapes. This is a
 * second, independent pdf-lib parse of the same bytes documentStore already
 * holds as `originalBytes` — cheap (no page rendering), and keeps the read
 * path decoupled from exportPdf's write path, consistent with exportPdf
 * always doing its own independent load rather than mutating a long-lived
 * document instance.
 */
export async function readFormFields(bytes: Uint8Array): Promise<FormField[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
  return doc.getForm().getFields().map(toFormField)
}
