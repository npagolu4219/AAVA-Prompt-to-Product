import type { RunMode, StepName } from './run'

/** Model tier per agent (deck slide 14). `none` = deterministic / tool-first: no LLM tokens. */
export type ModelTier = 'small' | 'medium' | 'large' | 'none'

/** One agent invocation's LLM usage, reported over AG-UI (CUSTOM "usage"). */
export interface UsageEntry {
  agent: string
  step: StepName
  tier: ModelTier
  inputTokens: number
  outputTokens: number
  /** Input tokens served from the prompt cache (billed at the cached rate). */
  cachedTokens: number
  latencyMs: number
}

export type Complexity = 'simple' | 'medium' | 'complex'

export type RunOutcome = 'delivered' | 'draft' | 'escalated' | 'cancelled' | 'error'

/** Immutable ledger row written when a run ends — the raw material of every ROI figure. */
export interface RunRecord {
  id: string
  threadId: string
  project: string
  screenId: string | null
  screenTitle: string
  scenarioId: string | null
  mode: RunMode
  startedAt: number
  finishedAt: number
  durationMs: number
  outcome: RunOutcome
  usage: UsageEntry[]
  hitlDecisions: number
  /** Measured time humans spent at HITL checkpoints (interrupt → decision). */
  hitlWaitMs: number
  components: number
  complexity: Complexity
  filesGenerated: number
  loc: number
  qualityScore: number | null
  firstPassScore: number | null
  iterations: number
  gapsAutoFixed: number
  /** Gaps still open when the run ended (escaped to human review). */
  gapsRemaining: number
  hardGatesPassed: boolean
  /** True for seeded demo rows (never mixed silently with live data). */
  sample?: boolean
}

export type Role = 'design' | 'dev' | 'qa'

export interface TierPricing {
  /** USD per 1M tokens. */
  input: number
  output: number
  cachedInput: number
}

/** Every number the engine uses that isn't measured — editable in the Assumptions drawer. */
export interface Assumptions {
  rates: Record<Role, number>
  /** Manual design → dev → QA effort per screen, hours. */
  baselineHours: Record<Complexity, Record<Role, number>>
  /** Human effort still needed after generation (logic wiring, review), hours. */
  residualHours: Record<Complexity, Record<Role, number>>
  /** Manual effort for a small change that a refine run replaces, hours. */
  refineBaselineHours: Record<Role, number>
  /** Calendar lead time per screen without the platform, working days. */
  baselineLeadDays: Record<Complexity, number>
  pricing: Record<Exclude<ModelTier, 'none'>, TierPricing>
  platformMonthlyCost: number
  /** One-time build/rollout cost, amortised monthly over `amortisationMonths`. */
  implementationCost: number
  amortisationMonths: number
  monthlyAiBudget: number
  /** Cost of a design/a11y defect caught late (rework + QA cycle). */
  defectCost: number
  /** Typical first-pass design-system compliance of hand-built screens. */
  baselineFirstPass: number
  /** Full-code LLM regeneration baseline: tokens per generated line, and loops until it looks right. */
  tokensPerLoc: number
  regenLoops: number
  /** Context a full-code approach re-sends on every call (whole design-system docs, no retrieval). */
  fullCodeContextTokens: number
  hoursPerDay: number
}
