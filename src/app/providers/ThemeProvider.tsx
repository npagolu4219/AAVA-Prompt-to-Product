import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { STORAGE_KEYS } from '@/config/app'
import { DEFAULT_THEME, DENSITY_UNIT_PX, FONT_SCALE, FONT_STACK, RADIUS_PX, THEME_PRESETS } from '@/config/themes'
import { useLocalStorage, useMediaQuery } from '@/hooks'
import type { ThemeSettings } from '@/types/theme'
import { readableOn } from '@/utils/color'

interface ThemeApi {
  settings: ThemeSettings
  resolvedMode: 'light' | 'dark'
  update: (patch: Partial<ThemeSettings>) => void
  applyPreset: (presetId: string) => void
  reset: () => void
  isCustomized: boolean
}

const ThemeContext = createContext<ThemeApi | null>(null)

/**
 * Owns user theme settings and writes them to CSS custom properties on <html>.
 * All component SCSS reads only these variables, so a change re-themes the
 * whole workspace — including the AAVA Play preview — without re-rendering.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<ThemeSettings>(STORAGE_KEYS.theme, DEFAULT_THEME)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolvedMode = settings.mode === 'system' ? (prefersDark ? 'dark' : 'light') : settings.mode

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedMode
    root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full'
    const vars: Record<string, string> = {
      '--c-primary': settings.primary,
      '--c-accent': settings.accent,
      '--c-ink': settings.ink,
      '--c-on-primary': readableOn(settings.primary),
      '--c-on-accent': readableOn(settings.accent),
      '--radius-base': `${RADIUS_PX[settings.radius]}px`,
      '--space-unit': `${DENSITY_UNIT_PX[settings.density]}px`,
      '--font-scale': String(FONT_SCALE[settings.fontScale]),
      '--font-sans': FONT_STACK[settings.fontFamily],
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedMode === 'dark' ? '#08121c' : settings.ink)
  }, [settings, resolvedMode])

  const update = useCallback((patch: Partial<ThemeSettings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings])

  const applyPreset = useCallback(
    (presetId: string) => {
      const p = THEME_PRESETS.find((x) => x.id === presetId)
      if (p) setSettings((s) => ({ ...s, presetId: p.id, primary: p.primary, accent: p.accent, ink: p.ink }))
    },
    [setSettings],
  )

  const reset = useCallback(() => setSettings(DEFAULT_THEME), [setSettings])

  const api = useMemo<ThemeApi>(() => {
    const preset = THEME_PRESETS.find((p) => p.id === settings.presetId)
    const isCustomized = !preset || preset.primary !== settings.primary || preset.accent !== settings.accent || preset.ink !== settings.ink
    return { settings, resolvedMode, update, applyPreset, reset, isCustomized }
  }, [settings, resolvedMode, update, applyPreset, reset])

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
