import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { summarize, threadStore, type ThreadRecord, type ThreadSummary } from '@/services/history/threadStore'

interface HistoryApi {
  threads: ThreadSummary[]
  loaded: boolean
  save: (t: ThreadRecord) => Promise<void>
  get: (id: string) => Promise<ThreadRecord | undefined>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

const Ctx = createContext<HistoryApi | null>(null)

/** Saved conversations (chat history), backed by IndexedDB. */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void threadStore.list().then((t) => {
      setThreads(t)
      setLoaded(true)
    })
  }, [])

  const upsert = useCallback((t: ThreadRecord) => setThreads((list) => [summarize(t), ...list.filter((x) => x.id !== t.id)].sort((a, b) => b.updatedAt - a.updatedAt)), [])

  const api = useMemo<HistoryApi>(
    () => ({
      threads,
      loaded,
      save: async (t) => {
        upsert(t)
        await threadStore.put(t)
      },
      get: (id) => threadStore.get(id),
      rename: async (id, title) => {
        const t = await threadStore.get(id)
        if (!t) return
        const next = { ...t, title: title.trim() || t.title }
        upsert(next)
        await threadStore.put(next)
      },
      remove: async (id) => {
        setThreads((list) => list.filter((x) => x.id !== id))
        await threadStore.remove(id)
      },
    }),
    [threads, loaded, upsert],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useHistory() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useHistory must be used inside <HistoryProvider>')
  return ctx
}
