import type { BaseObject } from '../../shared/types'

export type ZDirection = 'front' | 'back' | 'forward' | 'backward'

/** z for a newly-added object on a page = current object count (puts it on top). */
export function nextZ(objectsOnPage: readonly BaseObject[]): number {
  return objectsOnPage.length
}

/** Assigns z = array index to an already-correctly-ordered list. Objects
 *  whose z already matches their index keep the same reference (avoids
 *  unnecessary downstream re-renders of untouched Konva nodes). */
function assignPositionalZ<T extends BaseObject>(orderedObjects: readonly T[]): T[] {
  return orderedObjects.map((o, i) => (o.z === i ? o : { ...o, z: i }))
}

/**
 * Re-densifies z (0..n-1) after a mutation that only removes objects or
 * otherwise leaves gaps without changing relative order — e.g. after
 * filtering out a deleted object. Safe to sort by the (possibly gapped)
 * existing z here because relative order is still correct, just not dense.
 * Do NOT use this after reordering (see reorderZ, which must not re-sort by
 * the old z values).
 */
export function densifyZ<T extends BaseObject>(objectsOnPage: readonly T[]): T[] {
  const sorted = [...objectsOnPage].sort((a, b) => a.z - b.z)
  return assignPositionalZ(sorted)
}

/**
 * Returns a new array with `z` fields reassigned (dense, 0..n-1, matching
 * paint order) to reflect moving `id` in the requested direction relative to
 * its z-sorted position. Objects whose z doesn't change keep the same
 * reference (avoids unnecessary downstream re-renders of untouched Konva
 * nodes). Boundary moves (already front/back) and an unknown id are no-ops
 * that return the original array reference.
 */
export function reorderZ<T extends BaseObject>(
  objectsOnPage: readonly T[],
  id: string,
  direction: ZDirection
): T[] {
  const sorted = [...objectsOnPage].sort((a, b) => a.z - b.z)
  const currentIndex = sorted.findIndex((o) => o.id === id)
  if (currentIndex === -1) return objectsOnPage as T[]

  const lastIndex = sorted.length - 1
  const targetIndex =
    direction === 'front'
      ? lastIndex
      : direction === 'back'
        ? 0
        : direction === 'forward'
          ? Math.min(currentIndex + 1, lastIndex)
          : Math.max(currentIndex - 1, 0)

  if (targetIndex === currentIndex) return objectsOnPage as T[]

  const [moved] = sorted.splice(currentIndex, 1)
  sorted.splice(targetIndex, 0, moved)

  // NOT densifyZ: `sorted` is now in the desired final order after the
  // splice, but its elements still carry their OLD z values, which are no
  // longer monotonic in this new position order — re-sorting by them here
  // would silently undo the reorder.
  return assignPositionalZ(sorted)
}
