import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BREAKPOINTS } from '@/config/app'
import { storage } from '@/services/storage'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

/** True below the `md` breakpoint (phones, small tablets in portrait). */
export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.md - 0.02}px)`)

export function useLocalStorage<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => storage.get(key, initial))
  useEffect(() => storage.set(key, value), [key, value])
  return [value, setValue] as const
}

/** Keeps a scroll container pinned to the bottom while content grows, unless the user scrolled up. */
export function useAutoScroll<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null)
  const pinned = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [dep])

  return ref
}

/**
 * Like useAutoScroll, but also reports whether the view is pinned to the bottom so a
 * chat can offer a "jump to latest" affordance while the user reads older messages.
 */
export function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null)
  const pinned = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const next = el.scrollHeight - el.scrollTop - el.clientHeight < 48
      pinned.current = next
      setAtBottom(next)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // The viewport also shrinks when surrounding UI grows (composer, approval card) — stay pinned.
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [dep])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (!el) return
    pinned.current = true
    setAtBottom(true)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  return { ref, atBottom, scrollToBottom }
}

/** Calls handler on Escape while `active`. */
export function useEscape(active: boolean, handler: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handler()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, handler])
}

/** Re-render every `ms` while `active` (live durations). */
export function useTicker(active: boolean, ms = 250) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setTick((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [active, ms])
}
