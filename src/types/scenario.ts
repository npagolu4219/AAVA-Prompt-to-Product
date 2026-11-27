import type { A2uiComponent } from './a2ui'
import type { Row } from './datasource'
import type { Gap, ScenarioId } from './run'

export interface ScenarioPlan {
  summary: string
  items: string[]
}

export interface QualityInput {
  /** Scores in weight order: tokens, components, visual, a11y, critic. */
  dims: [number, number, number, number, number]
  gaps: Gap[]
  lintErrors: number
  a11yCritical: number
  rawColours: number
}

/** A targeted fix the Fixer agent applies to the A2UI tree. */
export interface ComponentFix {
  id: string
  set: Record<string, unknown>
  reason: string
}

/**
 * Data the agent imports from the connected database during Mind/Act.
 * `apply` maps query rows onto component props (keyed by component id).
 */
export interface DataNeed {
  table: string
  limit: number
  describe: string
  bindings: { componentId: string; prop: 'rows' | 'data' | 'items' | 'options' | 'props' }[]
  apply: (rows: Row[]) => Record<string, Record<string, unknown>>
}

export interface ShortlistItem {
  name: string
  score: number
  why: string
}

export interface Scenario {
  id: ScenarioId
  slug: string
  title: string
  keywords: string[]
  intent: { screenType: string } & Record<string, unknown>
  figma: { frameName: string; nodeCount: number; tokensMapped: number; tokensFlagged: number }
  shortlist: ShortlistItem[]
  contextPack: { tokens: number; budget: number; sources: string[] }
  plan: ScenarioPlan
  altPlan: ScenarioPlan
  responsive: string[]
  states: string[]
  components: A2uiComponent[]
  fixes: ComponentFix[]
  dataModel: Record<string, unknown>
  /** SCSS lines present in v1 that verification will catch. */
  defects: string[]
  quality: [QualityInput, QualityInput]
  dataNeeds: DataNeed[]
  /** Short label used for "add screen" suggestions. */
  suggestion: string
}
