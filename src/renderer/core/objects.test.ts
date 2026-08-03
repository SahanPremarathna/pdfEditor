import { describe, expect, it } from 'vitest'
import { createTextObject, findObjectById } from './objects'
import type { TextObject } from '../../shared/types'

describe('createTextObject', () => {
  it('builds a fully-defaulted TextObject at the given page/position/z', () => {
    const obj = createTextObject(2, 72, 100, 3, {}, () => 'fixed-id')

    expect(obj).toEqual<TextObject>({
      id: 'fixed-id',
      pageIndex: 2,
      type: 'text',
      x: 72,
      y: 100,
      width: 160,
      height: 24,
      rotation: 0,
      opacity: 1,
      z: 3,
      locked: false,
      text: '',
      fontFamily: 'sans',
      fontSize: 14,
      color: '#000000',
      bold: false,
      italic: false,
      align: 'left',
      lineHeight: 1.2
    })
  })

  it('applies overrides on top of the defaults', () => {
    const obj = createTextObject(0, 0, 0, 0, { text: 'Hello', fontSize: 24, bold: true }, () => 'id')

    expect(obj.text).toBe('Hello')
    expect(obj.fontSize).toBe(24)
    expect(obj.bold).toBe(true)
    expect(obj.color).toBe('#000000') // untouched defaults still apply
  })

  it('uses crypto.randomUUID() by default when no idFactory is given', () => {
    const obj = createTextObject(0, 0, 0, 0)
    expect(obj.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('findObjectById', () => {
  const a = createTextObject(0, 0, 0, 0, {}, () => 'a')
  const b = createTextObject(0, 0, 0, 1, {}, () => 'b')
  const c = createTextObject(1, 0, 0, 0, {}, () => 'c')
  const objectsByPage = { 0: [a, b], 1: [c] }

  it('finds an object on the first page bucket', () => {
    expect(findObjectById(objectsByPage, 'a')).toBe(a)
  })

  it('finds an object on a later page bucket', () => {
    expect(findObjectById(objectsByPage, 'c')).toBe(c)
  })

  it('returns undefined when the id is not present anywhere', () => {
    expect(findObjectById(objectsByPage, 'missing')).toBeUndefined()
  })

  it('returns undefined for an empty map', () => {
    expect(findObjectById({}, 'a')).toBeUndefined()
  })
})
