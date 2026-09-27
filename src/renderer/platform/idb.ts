/**
 * Minimal promise wrapper over one IndexedDB object store — just enough for
 * the recent-files list. No dependency; every call opens (and caches) the
 * same database connection.
 */
const DB_NAME = 'inkline'
const DB_VERSION = 1
export const RECENT_STORE = 'recent'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(RECENT_STORE)) {
        req.result.createObjectStore(RECENT_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open local storage'))
  })
  // A failed open (private mode, blocked storage) must not poison every later call.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(RECENT_STORE, mode)
        const req = fn(tx.objectStore(RECENT_STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('Local storage request failed'))
      })
  )
}

export const idbGetAll = <T>(): Promise<T[]> => run<T[]>('readonly', (s) => s.getAll() as IDBRequest<T[]>)
export const idbGet = <T>(key: string): Promise<T | undefined> =>
  run<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
export const idbPut = <T>(value: T): Promise<IDBValidKey> => run('readwrite', (s) => s.put(value))
export const idbDelete = (key: string): Promise<undefined> => run('readwrite', (s) => s.delete(key))
