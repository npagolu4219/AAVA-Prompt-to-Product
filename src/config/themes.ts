import type { Density, FontFamily, FontScale, RadiusStyle, ThemePreset, ThemeSettings } from '@/types/theme'

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'aava-teal', name: 'AAVA Teal', description: 'Brand default', primary: '#1B8A8A', accent: '#C2570C', ink: '#0F2A44' },
  { id: 'indigo-night', name: 'Indigo Night', description: 'Calm & focused', primary: '#4F46E5', accent: '#D97706', ink: '#1E1B4B' },
  { id: 'ocean', name: 'Ocean', description: 'Crisp product blue', primary: '#0B6BCB', accent: '#0F9D76', ink: '#0A2540' },
  { id: 'forest', name: 'Forest', description: 'Grounded greens', primary: '#2F7D4F', accent: '#B7791F', ink: '#14301F' },
  { id: 'sunset', name: 'Sunset', description: 'Warm & energetic', primary: '#D9480F', accent: '#7048E8', ink: '#2B1611' },
  { id: 'orchid', name: 'Orchid', description: 'Bold magenta', primary: '#A61E4D', accent: '#1971C2', ink: '#2A0F1C' },
  { id: 'graphite', name: 'Graphite', description: 'Neutral enterprise', primary: '#3F4F63', accent: '#0EA5E9', ink: '#0F172A' },
]

export const DEFAULT_THEME: ThemeSettings = {
  presetId: 'aava-teal',
  // Dark by default; users can switch to light or system in Theme & settings.
  // Keep in sync with the pre-paint script in index.html.
  mode: 'dark',
  primary: '#1B8A8A',
  accent: '#C2570C',
  ink: '#0F2A44',
  density: 'comfortable',
  radius: 'rounded',
  fontScale: 'md',
  fontFamily: 'plex',
  reduceMotion: false,
}

export const RADIUS_PX: Record<RadiusStyle, number> = { sharp: 4, rounded: 10, soft: 16 }
export const DENSITY_UNIT_PX: Record<Density, number> = { compact: 3.5, comfortable: 4, spacious: 4.5 }
export const FONT_SCALE: Record<FontScale, number> = { sm: 0.9375, md: 1, lg: 1.0625 }
export const FONT_STACK: Record<FontFamily, string> = {
  plex: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}
