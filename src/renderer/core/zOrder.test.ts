import { describe, expect, it } from 'vitest'
import { densifyZ, nextZ, reorderZ } from './zOrder'
import type { BaseObject } from '../../shared/types'

function fixture(id: string, z: number): BaseObject {
  return {
    id,
    pageIndex: 0,
    type: 'text',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    opacity: 1,
    z,
    locked: false
  }
}

describe('nextZ', () => {
  it('is 0 for an empty page', () => {
    expect(nextZ([])).toBe(0)
  })

  it('is the object count for a non-empty page', () => {
    expect(nextZ([fixture('a', 0), fixture('b', 1)])).toBe(2)
  })
})

describe('reorderZ', () => {
  const a = fixture('a', 0)
  const b = fixture('b', 1)
  const c = fixture('c', 2)
  const objects = [a, b, c]

  it('front: moves the object to the highest z', () => {
    const result = reorderZ(objects, 'a', 'front')
    expect(result.map((o) => o.id)).toEqual(['b', 'c', 'a'])
    expect(result.map((o) => o.z)).toEqual([0, 1, 2])
  })

  it('back: moves the object to the lowest z', () => {
    const result = reorderZ(objects, 'c', 'back')
    expect(result.map((o) => o.id)).toEqual(['c', 'a', 'b'])
    expect(result.map((o) => o.z)).toEqual([0, 1, 2])
  })

  it('forward: swaps with the next-higher object', () => {
    const result = reorderZ(objects, 'a', 'forward')
    expect(result.map((o) => o.id)).toEqual(['b', 'a', 'c'])
  })

  it('backward: swaps with the next-lower object', () => {
    const result = reorderZ(objects, 'c', 'backward')
    expect(result.map((o) => o.id)).toEqual(['a', 'c', 'b'])
  })

  it('front is a no-op (same reference) when already at the front', () => {
    const result = reorderZ(objects, 'c', 'front')
    expect(result).toBe(objects)
  })

  it('back is a no-op (same reference) when already at the back', () => {
    const result = reorderZ(objects, 'a', 'back')
    expect(result).toBe(objects)
  })

  it('forward is a no-op (same reference) when already at the front', () => {
    const result = reorderZ(objects, 'c', 'forward')
    expect(result).toBe(objects)
  })

  it('backward is a no-op (same reference) when already at the back', () => {
    const result = reorderZ(objects, 'a', 'backward')
    expect(result).toBe(objects)
  })

  it('is a no-op (same reference) for an unknown id', () => {
    const result = reorderZ(objects, 'missing', 'front')
    expect(result).toBe(objects)
  })

  it('keeps referential identity for objects whose z does not change', () => {
    const result = reorderZ(objects, 'a', 'forward')
    // c stays at z=2 throughout an a<->b swap
    const untouched = result.find((o) => o.id === 'c')
    expect(untouched).toBe(c)
  })

  it('handles a single-object page as a no-op in every direction', () => {
    const single = [fixture('only', 0)]
    for (const direction of ['front', 'back', 'forward', 'backward'] as const) {
      expect(reorderZ(single, 'only', direction)).toBe(single)
    }
  })
})

describe('densifyZ', () => {
  it('closes a gap left by removing a middle object', () => {
    const gapped = [fixture('a', 0), fixture('c', 2)] // b (z=1) was removed
    const result = densifyZ(gapped)
    expect(result.map((o) => ({ id: o.id, z: o.z }))).toEqual([
      { id: 'a', z: 0 },
      { id: 'c', z: 1 }
    ])
  })

  it('is a no-op for an already-dense list, keeping references', () => {
    const dense = [fixture('a', 0), fixture('b', 1)]
    const result = densifyZ(dense)
    expect(result[0]).toBe(dense[0])
    expect(result[1]).toBe(dense[1])
  })

  it('handles an empty page', () => {
    expect(densifyZ([])).toEqual([])
  })
})
