/** localStorage wrapper that never throws (private mode, quota, SSR). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
    } catch {
      return fallback
    }
  },
  set<T>(key: string, value: T) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  },
}
