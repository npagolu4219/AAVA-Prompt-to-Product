export type ColorMode = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type RadiusStyle = 'sharp' | 'rounded' | 'soft'
export type FontScale = 'sm' | 'md' | 'lg'
export type FontFamily = 'plex' | 'inter' | 'system'

export interface ThemePreset {
  id: string
  name: string
  description: string
  primary: string
  accent: string
  ink: string
}

export interface ThemeSettings {
  presetId: string
  mode: ColorMode
  primary: string
  accent: string
  ink: string
  density: Density
  radius: RadiusStyle
  fontScale: FontScale
  fontFamily: FontFamily
  reduceMotion: boolean
}
