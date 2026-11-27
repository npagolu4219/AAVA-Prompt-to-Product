/**
 * Conversation persistence in IndexedDB (no dependencies).
 * A thread holds messages + screens (A2UI surface, files, spec, quality, links) so it can be reopened.
 * Falls back to in-memory storage when IndexedDB is unavailable (private mode, old browsers).
 */
import type { ScreenState } from '@/types/project'
import type { ChatMessage } from '@/types/run'

export interface ThreadRecord {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  screens: ScreenState[]
  activeScreenId: string | null
  runCount: number
}

export interface ThreadSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  screens: { id: string; title: string; score: number | null; signedOff: boolean }[]
  messages: number
  preview: string
}

const DB = 'aava-p2p'
const STORE = 'threads'
const memory = new Map<string, ThreadRecord>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined)
        const req = fn(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(undefined)
      }),
  )
}

export const summarize = (t: ThreadRecord): ThreadSummary => ({
  id: t.id,
  title: t.title,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  screens: t.screens.filter((s) => s.surface).map((s) => ({ id: s.id, title: s.shared.title, score: s.shared.quality?.score ?? null, signedOff: s.signedOff })),
  messages: t.messages.length,
  preview: t.messages.find((m) => m.role === 'user')?.content.split('\n')[0].slice(0, 140) ?? '',
})

export const threadStore = {
  async list(): Promise<ThreadSummary[]> {
    const rows = (await tx<ThreadRecord[]>('readonly', (s) => s.getAll())) ?? [...memory.values()]
    return rows.map(summarize).sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async get(id: string): Promise<ThreadRecord | undefined> {
    return (await tx<ThreadRecord>('readonly', (s) => s.get(id))) ?? memory.get(id)
  },
  async put(t: ThreadRecord): Promise<void> {
    memory.set(t.id, t)
    await tx('readwrite', (s) => s.put(t))
  },
  async remove(id: string): Promise<void> {
    memory.delete(id)
    await tx('readwrite', (s) => s.delete(id))
  },
}
