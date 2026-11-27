import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useLocalStorage } from '@/hooks'
import { SEED_RESOURCES, simulateIndex, toHandle } from '@/services/resources/catalog'
import type { Resource, ResourceKind, ResourceRef } from '@/types/resources'
import { uid } from '@/utils/format'

interface ResourcesApi {
  resources: Resource[]
  enabled: Resource[]
  add: (input: { kind: ResourceKind; name: string; config: Record<string, string>; content?: string }) => string
  update: (id: string, patch: Partial<Pick<Resource, 'name' | 'config' | 'enabled' | 'handle'>>) => void
  toggle: (id: string) => void
  reindex: (id: string) => void
  remove: (id: string) => void
  /** Enabled resources + any @mentioned in the prompt (even if disabled). */
  refsFor: (prompt: string) => ResourceRef[]
  byHandle: (handle: string) => Resource | undefined
}

const Ctx = createContext<ResourcesApi | null>(null)
const KEY = 'aava-p2p.resources.v1'
const MAX_CONTENT = 60_000

/** Context sources (codebase, Figma, docs, API specs, uploads) the agents ground on. */
export function ResourcesProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useLocalStorage<{ items: Resource[] }>(KEY, { items: SEED_RESOURCES })
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>())

  const patch = useCallback((id: string, p: Partial<Resource>) => setStore((s) => ({ items: s.items.map((r) => (r.id === id ? { ...r, ...p } : r)) })), [setStore])

  /** Simulated indexing: progress ticks, then stats (or an error). */
  const runIndex = useCallback(
    (r: Resource) => {
      clearInterval(timers.current.get(r.id))
      patch(r.id, { status: 'indexing', progress: 0, message: 'Cloning & chunking…' })
      let p = 0
      const t = setInterval(() => {
        p = Math.min(1, p + 0.08 + Math.random() * 0.12)
        if (p < 1) return patch(r.id, { progress: p })
        clearInterval(t)
        timers.current.delete(r.id)
        const res = simulateIndex(r)
        patch(r.id, res.ok ? { status: 'indexed', progress: 1, stats: res.stats, message: res.message, indexedAt: Date.now() } : { status: 'error', progress: 1, message: res.message, enabled: false })
      }, 220)
      timers.current.set(r.id, t)
    },
    [patch],
  )

  // Resume anything left mid-index by a reload.
  useEffect(() => {
    store.items.filter((r) => r.status === 'indexing').forEach(runIndex)
    const map = timers.current
    return () => map.forEach(clearInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const api = useMemo<ResourcesApi>(() => {
    const items = store.items
    const unique = (h: string) => {
      let handle = toHandle(h)
      let i = 2
      while (items.some((r) => r.handle === handle)) handle = `${toHandle(h)}-${i++}`
      return handle
    }
    return {
      resources: items,
      enabled: items.filter((r) => r.enabled && r.status === 'indexed'),
      add: ({ kind, name, config, content }) => {
        const r: Resource = { id: uid('res'), kind, name, handle: unique(name), enabled: true, config, content: content?.slice(0, MAX_CONTENT), status: 'pending', progress: 0, stats: null, createdAt: Date.now() }
        setStore((s) => ({ items: [r, ...s.items] }))
        setTimeout(() => runIndex(r), 50)
        return r.id
      },
      update: (id, p) => {
        const cur = items.find((r) => r.id === id)
        patch(id, p)
        if (cur && p.config && JSON.stringify(p.config) !== JSON.stringify(cur.config)) runIndex({ ...cur, ...p } as Resource)
      },
      toggle: (id) => patch(id, { enabled: !items.find((r) => r.id === id)?.enabled }),
      reindex: (id) => {
        const r = items.find((x) => x.id === id)
        if (r) runIndex(r)
      },
      remove: (id) => {
        clearInterval(timers.current.get(id))
        setStore((s) => ({ items: s.items.filter((r) => r.id !== id) }))
      },
      byHandle: (h) => items.find((r) => r.handle === h.toLowerCase()),
      refsFor: (prompt) => {
        const mentioned = new Set([...prompt.matchAll(/@([a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase()))
        return items
          .filter((r) => r.status === 'indexed' && (r.enabled || mentioned.has(r.handle)))
          .map((r) => ({ id: r.id, kind: r.kind, name: r.name, handle: r.handle, config: r.config, mentioned: mentioned.has(r.handle), excerpt: r.content?.slice(0, 600) }))
      },
    }
  }, [store.items, setStore, patch, runIndex])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useResources() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useResources must be used inside <ResourcesProvider>')
  return ctx
}
