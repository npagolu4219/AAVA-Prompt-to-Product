import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

export type Route = 'home' | 'studio' | 'resources' | 'history' | 'roi'

const ROUTES: Record<string, Route> = { '#/studio': 'studio', '#/resources': 'resources', '#/history': 'history', '#/roi': 'roi' }

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  // Back/forward, typed URLs and plain <a href="#/…"> links still arrive via hashchange.
  window.addEventListener('hashchange', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('hashchange', cb)
  }
}

/** Tiny hash router so browser back/forward and deep links work without a dependency. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  const navigate = useCallback((r: Route) => {
    const next = r === 'home' ? '#/' : `#/${r}`
    if (window.location.hash === next) return
    window.location.hash = next
    // `hashchange` fires asynchronously. Notify React now so a caller's flushSync (inside a
    // view transition) renders the new page before the browser snapshots it — otherwise the
    // transition animates old → old and the real page pops in afterwards (visible flicker).
    emit()
  }, [])
  return [ROUTES[hash] ?? 'home', navigate]
}

/** Lets page headers open the mobile navigation drawer. */
export const NavMenuContext = createContext<() => void>(() => undefined)
export const useOpenNav = () => useContext(NavMenuContext)
