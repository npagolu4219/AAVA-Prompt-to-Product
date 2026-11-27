/**
 * AAVA Play catalog — the only vocabulary the A2UI Composer is allowed to speak.
 * Export this list as the catalog schema for the AAVA KB (slide 23, step 6).
 */
import type { A2uiAction } from '@/types/a2ui'
import * as C from './components'
import type { CatalogComponent } from './components'

export type { CatalogProps } from './components'

export const AAVA_PLAY_CATALOG: Record<string, CatalogComponent> = {
  Column: C.Column,
  Row: C.Row,
  Grid: C.Grid,
  AavaCard: C.AavaCard,
  AavaHeading: C.AavaHeading,
  AavaText: C.AavaText,
  AavaBadge: C.AavaBadge,
  AavaTextField: C.AavaTextField,
  AavaCheckbox: C.AavaCheckbox,
  AavaToggle: C.AavaToggle,
  AavaSelect: C.AavaSelect,
  AavaButton: C.AavaButton,
  AavaLink: C.AavaLink,
  AavaDivider: C.AavaDivider,
  AavaAvatar: C.AavaAvatar,
  AavaStatCard: C.AavaStatCard,
  AavaBarChart: C.AavaBarChart,
  AavaTable: C.AavaTable,
  AavaList: C.AavaList,
}

export const CATALOG_COMPONENTS = Object.keys(AAVA_PLAY_CATALOG)

export const isA2uiAction = (v: unknown): v is A2uiAction =>
  typeof v === 'object' && v !== null && 'event' in v && typeof (v as A2uiAction).event?.name === 'string'
