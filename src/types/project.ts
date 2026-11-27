import type { SurfaceState } from './a2ui'
import type { RunSource, SharedState } from './run'

/** Navigation edge in the user flow: an action on one screen opens another. */
export interface ScreenLink {
  action: string
  label: string
  targetId: string
}

/** One generated screen in the multi-screen project (max 10). */
export interface ScreenState {
  id: string
  slug: string
  route: string
  source: RunSource
  surface: SurfaceState | null
  shared: SharedState
  activeFile: string | null
  links: ScreenLink[]
  /** Paths the user edited by hand in Monaco (preserved on export). */
  editedPaths: string[]
  signedOff: boolean
  createdAt: number
}
