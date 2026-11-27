import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { STORAGE_KEYS } from '@/config/app'
import { useLocalStorage } from '@/hooks'
import { DEMO_SOURCE, dataSourceClient } from '@/services/datasource/client'
import type { ConnectionResult, DataSourceConfig, Row, TableSchema } from '@/types/datasource'
import { uid } from '@/utils/format'

interface Persisted {
  sources: DataSourceConfig[]
  activeId: string | null
}

interface DataSourceApi {
  sources: DataSourceConfig[]
  active: DataSourceConfig | null
  clientKind: 'mock' | 'http'
  setActive: (id: string | null) => void
  add: (config: Omit<DataSourceConfig, 'id' | 'createdAt' | 'status'>, password: string) => Promise<ConnectionResult>
  test: (id: string, password: string) => Promise<ConnectionResult>
  remove: (id: string) => void
  listTables: (id: string) => Promise<TableSchema[]>
  query: (id: string, table: string, limit: number, columns?: string[]) => Promise<Row[]>
}

const Ctx = createContext<DataSourceApi | null>(null)

/**
 * Database connections the agents may import data from.
 * Only connection metadata is persisted — passwords go straight to the BFF vault.
 */
export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useLocalStorage<Persisted>(STORAGE_KEYS.dataSources, { sources: [DEMO_SOURCE], activeId: DEMO_SOURCE.id })

  const find = useCallback((id: string) => {
    const s = store.sources.find((x) => x.id === id)
    if (!s) throw new Error(`Unknown data source ${id}`)
    return s
  }, [store.sources])

  const patch = useCallback((id: string, p: Partial<DataSourceConfig>) => setStore((st) => ({ ...st, sources: st.sources.map((s) => (s.id === id ? { ...s, ...p } : s)) })), [setStore])

  const test = useCallback(
    async (id: string, password: string) => {
      const res = await dataSourceClient.test(find(id), password)
      patch(id, { status: res.ok ? 'connected' : 'error', lastMessage: res.message })
      return res
    },
    [find, patch],
  )

  const add = useCallback(
    async (config: Omit<DataSourceConfig, 'id' | 'createdAt' | 'status'>, password: string) => {
      const full: DataSourceConfig = { ...config, id: uid('src'), createdAt: Date.now(), status: 'untested' }
      const res = await dataSourceClient.test(full, password)
      const saved = { ...full, status: res.ok ? ('connected' as const) : ('error' as const), lastMessage: res.message }
      setStore((st) => ({ sources: [...st.sources, saved], activeId: res.ok ? saved.id : st.activeId }))
      return res
    },
    [setStore],
  )

  const api = useMemo<DataSourceApi>(
    () => ({
      sources: store.sources,
      active: store.sources.find((s) => s.id === store.activeId && s.status === 'connected') ?? null,
      clientKind: dataSourceClient.kind,
      setActive: (id) => setStore((st) => ({ ...st, activeId: id })),
      add,
      test,
      remove: (id) => setStore((st) => ({ sources: st.sources.filter((s) => s.id !== id), activeId: st.activeId === id ? null : st.activeId })),
      listTables: (id) => dataSourceClient.listTables(find(id)),
      query: (id, table, limit, columns) => dataSourceClient.query(find(id), table, { limit, columns }),
    }),
    [store, setStore, add, test, find],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useDataSources() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDataSources must be used inside <DataSourceProvider>')
  return ctx
}
