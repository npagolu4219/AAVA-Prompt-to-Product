/**
 * A2UI v0.9 — declarative UI description sent from agent → client.
 * The agent can only reference components that exist in the client catalog;
 * no executable code ever crosses this boundary.
 */

export interface DataBinding {
  path: string
}

export type Bound<T> = T | DataBinding

export interface A2uiAction {
  event: { name: string; context?: Record<string, unknown> }
}

export interface A2uiComponent {
  id: string
  component: string
  children?: string[]
  [prop: string]: unknown
}

interface Versioned {
  version: 'v0.9'
}

export type A2uiMessage =
  | (Versioned & { createSurface: { surfaceId: string; catalogId?: string } })
  | (Versioned & { updateComponents: { surfaceId: string; components: A2uiComponent[] } })
  | (Versioned & { updateDataModel: { surfaceId: string; path: string; value: unknown } })
  | (Versioned & { deleteSurface: { surfaceId: string } })

export interface SurfaceState {
  surfaceId: string
  catalogId: string
  rootId: string
  components: Record<string, A2uiComponent>
  dataModel: Record<string, unknown>
  /** Snapshot of the data model as the agent sent it (for "reset data"). */
  initialDataModel: Record<string, unknown>
  /** Incremented on every updateComponents batch. */
  revision: number
}

export const isBinding = (v: unknown): v is DataBinding =>
  typeof v === 'object' && v !== null && 'path' in v && typeof (v as DataBinding).path === 'string'
