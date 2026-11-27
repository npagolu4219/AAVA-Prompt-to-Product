import type { A2uiComponent } from './a2ui'
import type { ContextUse, ResourceRef } from './resources'

export type StepName = 'Sense' | 'Match' | 'Mind' | 'Think' | 'Act' | 'Verify' | 'Refine' | 'Deliver'

export type StepStatus = 'pending' | 'running' | 'waiting' | 'done' | 'skipped' | 'error'

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'done'
  result?: string
  startedAt: number
  endedAt?: number
}

export interface StepState {
  name: StepName
  status: StepStatus
  summary?: string
  iterations: number
  toolCalls: ToolCall[]
  startedAt?: number
  endedAt?: number
}

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  streaming?: boolean
  tone?: 'info' | 'success' | 'warning' | 'danger'
  /** Context sources the agent grounded this step on. */
  context?: ContextUse[]
}

export type HitlChoice = 'approve' | 'edit' | 'reject'
export type InterruptKind = 'plan' | 'final' | 'escalation'

export interface Interrupt {
  id: string
  kind: InterruptKind
  /** Which HITL checkpoint (① plan, ② final, ③ escalation). */
  checkpoint: 1 | 2 | 3
  title: string
  body: string
  details?: string[]
  options: HitlChoice[]
  labels?: Partial<Record<HitlChoice, string>>
}

export interface HitlDecision {
  interruptId: string
  decision: HitlChoice
  note?: string
}

export interface GenFile {
  path: string
  language: string
  content: string
}

export type Verifier = 'critic' | 'audit' | 'lint' | 'playwright'
export type FixKind = 'token' | 'prop' | 'component' | 'a11y'

export interface Gap {
  el: string
  prop: string
  found: string
  expected: string
  rule: string
  fix: FixKind
  severity: 'hard' | 'soft'
  source: Verifier
}

export type QualityKey = 'tokens' | 'components' | 'visual' | 'a11y' | 'critic'

export interface QualityDimension {
  key: QualityKey
  label: string
  weight: number
  score: number
}

export interface HardGate {
  label: string
  passed: boolean
}

export type GateDecision = 'deliver' | 'autofix' | 'escalate'

export interface QualityReport {
  score: number
  iteration: number
  dimensions: QualityDimension[]
  gaps: Gap[]
  hardGates: HardGate[]
  lintErrors: number
  a11yCritical: number
  decision: GateDecision
  history: number[]
}

/** Built-in scenario ids, or `generic-<slug>` for screens built from free-form prompts. */
export type ScenarioId = string

/** A component prop whose value was imported from a database table. */
export interface CollectionBinding {
  componentId: string
  /** Which prop receives the rows (rows, data, items, options) — or `props` for single-record bindings like KPI tiles. */
  prop: 'rows' | 'data' | 'items' | 'options' | 'props'
  table: string
  source: string
  rowCount: number
}

/** Shared state synchronised over AG-UI STATE_SNAPSHOT / STATE_DELTA. */
export interface SharedState {
  scenarioId: ScenarioId | null
  title: string
  version: number
  files: GenFile[]
  previousFiles: GenFile[]
  spec: string
  quality: QualityReport | null
  changelog: string[]
  bindings: CollectionBinding[]
}

export type RunStatus = 'idle' | 'running' | 'waiting' | 'finished' | 'error' | 'cancelled'
export type RunMode = 'full' | 'refine'

export interface FigmaRef {
  url: string
  /** Personal access token — goes to the BFF vault only, never into chat or LLM context. */
  token: string
}

export interface RunOptions {
  autoApprovePlan: boolean
  speed: number
}

export interface ProjectScreenRef {
  id: string
  title: string
  slug: string
  route: string
  primaryAction?: string
}

export interface DataSourceRef {
  id: string
  name: string
  kind: string
}

export interface RefineContext {
  scenarioId: ScenarioId
  components: A2uiComponent[]
  dataModel: Record<string, unknown>
  version: number
  quality: QualityReport | null
  files: GenFile[]
  changelog: string[]
  bindings: CollectionBinding[]
}

export interface RunInput {
  threadId: string
  prompt: string
  mode: RunMode
  figma?: FigmaRef
  options: RunOptions
  context?: RefineContext
  /** Unique slug + position the client reserved for a new screen. */
  screen: { id: string; slug: string; index: number; max: number }
  /** Other screens already in the project (for flow linking). */
  project: ProjectScreenRef[]
  /** Connected database the agent may introspect and query. */
  dataSource: DataSourceRef | null
  /** Org codebase, Figma libraries, docs, API specs… enabled or @-mentioned for this run. */
  resources: ResourceRef[]
}

export interface RunSource {
  kind: 'prompt' | 'figma'
  label: string
}
