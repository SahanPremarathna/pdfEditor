import { describe, expect, it } from 'vitest'
import { createImageObject, createPathObject, createShapeObject, createTextObject, findObjectById } from './objects'
import type { ImageObject, PathObject, ShapeObject, TextObject } from '../../shared/types'

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

describe('createShapeObject', () => {
  it('builds a rect with stroke-only defaults (no fill)', () => {
    const obj = createShapeObject('rect', 0, 10, 20, 100, 50, 2, {}, () => 'id')

    expect(obj).toEqual<ShapeObject>({
      id: 'id',
      pageIndex: 0,
      type: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
      opacity: 1,
      z: 2,
      locked: false,
      fill: null,
      stroke: '#1d4ed8',
      strokeWidth: 2
    })
  })

  it('builds a highlight with a fill, no stroke, and reduced default opacity', () => {
    const obj = createShapeObject('highlight', 0, 0, 0, 10, 10, 0, {}, () => 'id')

    expect(obj.fill).toBe('#fde047')
    expect(obj.stroke).toBeNull()
    expect(obj.opacity).toBe(0.4)
  })

  it('builds a whiteout with opaque white fill, no stroke, full opacity', () => {
    const obj = createShapeObject('whiteout', 0, 0, 0, 10, 10, 0, {}, () => 'id')

    expect(obj.fill).toBe('#ffffff')
    expect(obj.stroke).toBeNull()
    expect(obj.opacity).toBe(1)
  })

  it('applies overrides on top of type defaults', () => {
    const obj = createShapeObject('rect', 0, 0, 0, 10, 10, 0, { fill: '#ff0000' }, () => 'id')
    expect(obj.fill).toBe('#ff0000')
  })
})

describe('createPathObject', () => {
  it('builds a freehand path with the given points and default stroke', () => {
    const points = [[0, 0, 5, 5, 10, 0]]
    const obj = createPathObject('freehand', 1, 5, 5, 10, 10, points, 0, {}, () => 'id')

    expect(obj).toEqual<PathObject>({
      id: 'id',
      pageIndex: 1,
      type: 'freehand',
      x: 5,
      y: 5,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      z: 0,
      locked: false,
      points,
      stroke: '#111827',
      strokeWidth: 2
    })
  })

  it('builds a signature the same shape as freehand, just a different type tag', () => {
    const obj = createPathObject('signature', 0, 0, 0, 20, 8, [[0, 0, 20, 8]], 0, {}, () => 'id')
    expect(obj.type).toBe('signature')
    expect(obj.points).toEqual([[0, 0, 20, 8]])
  })
})

describe('createImageObject', () => {
  it('builds an ImageObject from the given dataUrl/mime', () => {
    const obj = createImageObject(0, 10, 10, 100, 80, 'data:image/png;base64,AAA', 'image/png', 1, {}, () => 'id')

    expect(obj).toEqual<ImageObject>({
      id: 'id',
      pageIndex: 0,
      type: 'image',
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      rotation: 0,
      opacity: 1,
      z: 1,
      locked: false,
      dataUrl: 'data:image/png;base64,AAA',
      mime: 'image/png'
    })
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
