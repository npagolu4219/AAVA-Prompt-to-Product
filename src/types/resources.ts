export type ResourceKind = 'codebase' | 'figma' | 'design-system' | 'openapi' | 'docs' | 'upload'

export type ResourceStatus = 'indexed' | 'indexing' | 'error' | 'pending'

export interface ResourceStats {
  files: number
  chunks: number
  tokens: number
  /** Kind-specific highlights, e.g. "Angular 21 · 42 components". */
  highlights: string[]
}

export interface Resource {
  id: string
  kind: ResourceKind
  name: string
  /** Mention handle used in prompts: @handle */
  handle: string
  enabled: boolean
  /** Non-secret configuration (URL, branch, paths, file key…). */
  config: Record<string, string>
  status: ResourceStatus
  progress: number
  stats: ResourceStats | null
  message?: string
  indexedAt?: number
  createdAt: number
  /** Uploaded text content (uploads only, truncated). */
  content?: string
}

/** What the agent receives for a resource in RunInput. */
export interface ResourceRef {
  id: string
  kind: ResourceKind
  name: string
  handle: string
  config: Record<string, string>
  mentioned: boolean
  excerpt?: string
}

/** Context the agent reports it actually used (rendered as chips in chat). */
export interface ContextUse {
  kind: ResourceKind
  name: string
  detail: string
}
