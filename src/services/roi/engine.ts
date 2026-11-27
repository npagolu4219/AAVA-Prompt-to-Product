/**
 * Business value calculation engine — pure functions, no I/O.
 *
 *   value      = labour saved (baseline hours − actual hours) × role rate  +  defects avoided × defect cost
 *   investment = AI spend (tokens × tier price, cache-aware)  +  platform cost (pro-rated to the period)
 *   net        = value − investment          ROI = net ÷ investment
 *
 * Measured inputs come from the run ledger (tokens, HITL time, durations, quality, LOC);
 * everything else is an explicit, editable Assumption.
 */
import type { Assumptions, Complexity, ModelTier, Role, RunRecord, UsageEntry } from '@/types/roi'

export const ROLES: Role[] = ['design', 'dev', 'qa']
export const ROLE_LABEL: Record<Role, string> = { design: 'Design', dev: 'Development', qa: 'QA' }
const DAY = 86_400_000
const H = 3_600_000

type RoleHours = Record<Role, number>
const zero = (): RoleHours => ({ design: 0, dev: 0, qa: 0 })
const sumH = (h: RoleHours) => h.design + h.dev + h.qa
const scale = (h: RoleHours, k: number): RoleHours => ({ design: h.design * k, dev: h.dev * k, qa: h.qa * k })
const add = (a: RoleHours, b: RoleHours): RoleHours => ({ design: a.design + b.design, dev: a.dev + b.dev, qa: a.qa + b.qa })

export function usageCost(u: UsageEntry, a: Assumptions): number {
  if (u.tier === 'none') return 0
  const p = a.pricing[u.tier]
  const fresh = Math.max(0, u.inputTokens - u.cachedTokens)
  return (fresh * p.input + u.cachedTokens * p.cachedInput + u.outputTokens * p.output) / 1_000_000
}

/** What the same tokens would cost with no prompt cache. */
const uncachedCost = (u: UsageEntry, a: Assumptions) => (u.tier === 'none' ? 0 : (u.inputTokens * a.pricing[u.tier].input + u.outputTokens * a.pricing[u.tier].output) / 1_000_000)

export interface RunValue {
  record: RunRecord
  built: boolean
  baseline: RoleHours
  actual: RoleHours
  hoursSaved: number
  laborBaseline: number
  laborActual: number
  laborSaved: number
  defectsValue: number
  aiCost: number
  cacheSavings: number
  tokens: { input: number; output: number; cached: number }
  baselineTokens: number
  leadBaselineH: number
  leadActualH: number
  value: number
}

const labor = (h: RoleHours, a: Assumptions) => ROLES.reduce((n, r) => n + h[r] * a.rates[r], 0)

/** Value of a single run. */
export function evaluateRun(r: RunRecord, a: Assumptions): RunValue {
  const review: RoleHours = { design: r.hitlWaitMs / H, dev: 0, qa: 0 }
  const built = r.mode === 'full' && (r.outcome === 'delivered' || r.outcome === 'draft' || r.outcome === 'escalated')
  const refined = r.mode === 'refine' && (r.outcome === 'delivered' || r.outcome === 'draft')
  let baseline = zero()
  let actual = review
  if (built) {
    baseline = { ...a.baselineHours[r.complexity] }
    // Escalated screens needed more human help to finish.
    actual = add(review, scale(a.residualHours[r.complexity], r.outcome === 'escalated' ? 1.5 : 1))
  } else if (refined) {
    baseline = { ...a.refineBaselineHours }
    actual = add(review, { design: 0, dev: 0.1, qa: 0.05 })
  }
  const aiCost = r.usage.reduce((n, u) => n + usageCost(u, a), 0)
  const tokens = r.usage.reduce((t, u) => ({ input: t.input + u.inputTokens, output: t.output + u.outputTokens, cached: t.cached + u.cachedTokens }), { input: 0, output: 0, cached: 0 })
  const composer = r.usage.find((u) => u.agent === 'A2UI Composer')?.inputTokens ?? 4000
  // Full-code LLM regeneration baseline (deck slides 19/27): every loop re-sends the whole design
  // context (no top-k retrieval) plus the previous code, and regenerates the full file.
  const code = r.loc * a.tokensPerLoc
  const loops = Math.max(1, a.regenLoops)
  const baselineTokens = built
    ? Array.from({ length: Math.ceil(loops) }, (_, i) => (a.fullCodeContextTokens + (i > 0 ? code : 0) + code) * Math.min(1, loops - i)).reduce((n, x) => n + x, 0)
    : refined
      ? a.fullCodeContextTokens + code * 2
      : 0
  void composer
  const laborBaseline = labor(baseline, a)
  const laborActual = labor(actual, a)
  const defectsValue = (built || refined ? r.gapsAutoFixed : 0) * a.defectCost
  const leadBaselineH = built ? a.baselineLeadDays[r.complexity] * a.hoursPerDay : 0
  const leadActualH = built ? (r.durationMs + r.hitlWaitMs) / H + sumH(a.residualHours[r.complexity]) : 0
  return {
    record: r,
    built,
    baseline,
    actual,
    hoursSaved: sumH(baseline) - sumH(actual),
    laborBaseline,
    laborActual,
    laborSaved: laborBaseline - laborActual,
    defectsValue,
    aiCost,
    cacheSavings: r.usage.reduce((n, u) => n + uncachedCost(u, a), 0) - aiCost,
    tokens,
    baselineTokens,
    leadBaselineH,
    leadActualH,
    value: laborBaseline - laborActual + defectsValue,
  }
}

export interface RoiFilters {
  from: number
  to: number
  project: string | 'all'
}

export interface Aggregate {
  runs: number
  screensBuilt: number
  delivered: number
  refines: number
  failed: number
  baselineHours: number
  actualHours: number
  hoursSaved: number
  laborBaseline: number
  laborActual: number
  laborSaved: number
  defectsValue: number
  value: number
  aiCost: number
  cacheSavings: number
  platformCost: number
  investment: number
  net: number
  roi: number | null
  paybackDays: number | null
  tokens: { input: number; output: number; cached: number }
  baselineTokens: number
  builtTokens: number
  tokenReduction: number | null
  firstPassRate: number | null
  /** Share of built screens DS-compliant (≥ 0.90, hard gates pass) when a human first reviews them. */
  reviewReadyRate: number | null
  gapsRemaining: number
  avgQuality: number | null
  hitlDecisions: number
  hitlMinutes: number
  leadBaselineH: number
  leadActualH: number
}

function aggregate(values: RunValue[], platformCost: number, periodDays: number): Aggregate {
  const built = values.filter((v) => v.built)
  const sum = (f: (v: RunValue) => number, list = values) => list.reduce((n, v) => n + f(v), 0)
  const aiCost = sum((v) => v.aiCost)
  const value = sum((v) => v.value)
  const investment = aiCost + platformCost
  const net = value - investment
  const firstPass = built.filter((v) => v.record.firstPassScore != null)
  const quality = values.filter((v) => v.record.qualityScore != null && v.record.mode === 'full')
  const builtTokens = sum((v) => v.tokens.input + v.tokens.output, built)
  const baselineTokens = sum((v) => v.baselineTokens, built)
  return {
    runs: values.length,
    screensBuilt: built.length,
    delivered: values.filter((v) => v.record.outcome === 'delivered' && v.record.mode === 'full').length,
    refines: values.filter((v) => v.record.mode === 'refine').length,
    failed: values.filter((v) => v.record.outcome === 'cancelled' || v.record.outcome === 'error').length,
    baselineHours: sum((v) => sumH(v.baseline)),
    actualHours: sum((v) => sumH(v.actual)),
    hoursSaved: sum((v) => v.hoursSaved),
    laborBaseline: sum((v) => v.laborBaseline),
    laborActual: sum((v) => v.laborActual),
    laborSaved: sum((v) => v.laborSaved),
    defectsValue: sum((v) => v.defectsValue),
    value,
    aiCost,
    cacheSavings: sum((v) => v.cacheSavings),
    platformCost,
    investment,
    net,
    roi: investment > 0 ? net / investment : null,
    paybackDays: value > 0 && periodDays > 0 ? investment / (value / periodDays) : null,
    tokens: values.reduce((t, v) => ({ input: t.input + v.tokens.input, output: t.output + v.tokens.output, cached: t.cached + v.tokens.cached }), { input: 0, output: 0, cached: 0 }),
    baselineTokens,
    builtTokens,
    tokenReduction: baselineTokens > 0 ? 1 - builtTokens / baselineTokens : null,
    firstPassRate: firstPass.length ? firstPass.filter((v) => (v.record.firstPassScore ?? 0) >= 0.9).length / firstPass.length : null,
    reviewReadyRate: built.length ? built.filter((v) => (v.record.qualityScore ?? 0) >= 0.9 && v.record.hardGatesPassed).length / built.length : null,
    gapsRemaining: sum((v) => v.record.gapsRemaining ?? 0, built),
    avgQuality: quality.length ? quality.reduce((n, v) => n + (v.record.qualityScore ?? 0), 0) / quality.length : null,
    hitlDecisions: sum((v) => v.record.hitlDecisions),
    hitlMinutes: sum((v) => v.record.hitlWaitMs) / 60_000,
    leadBaselineH: sum((v) => v.leadBaselineH, built),
    leadActualH: sum((v) => v.leadActualH, built),
  }
}

export interface ProjectRow extends Aggregate {
  project: string
  sample: boolean
  lastRun: number
}

export interface AgentRow {
  agent: string
  tier: ModelTier
  calls: number
  tokens: number
  cost: number
  avgLatencyMs: number
}

export interface DailyPoint {
  day: number
  aiCost: number
  value: number
  hoursSaved: number
  runs: number
  cumValue: number
  cumInvestment: number
}

export interface RoiReport {
  periodDays: number
  totals: Aggregate
  projects: ProjectRow[]
  agents: AgentRow[]
  tiers: { tier: Exclude<ModelTier, 'none'>; tokens: number; cost: number }[]
  roles: { role: Role; baseline: number; actual: number }[]
  daily: DailyPoint[]
  complexity: Record<Complexity, number>
  budget: { limit: number; spent: number; used: number }
}

const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0)

export function computeRoi(records: RunRecord[], a: Assumptions, f: RoiFilters): RoiReport {
  const inPeriod = records.filter((r) => r.finishedAt >= f.from && r.finishedAt <= f.to)
  const scoped = f.project === 'all' ? inPeriod : inPeriod.filter((r) => r.project === f.project)
  const periodDays = Math.max(1, (f.to - f.from) / DAY)
  const allPlatform = (a.platformMonthlyCost + a.implementationCost / Math.max(1, a.amortisationMonths)) * (periodDays / 30)
  // A single project carries the platform cost in proportion to the screens it built.
  const builtAll = inPeriod.filter((r) => r.mode === 'full').length || 1
  const share = (rows: RunRecord[]) => rows.filter((r) => r.mode === 'full').length / builtAll
  const values = scoped.map((r) => evaluateRun(r, a))
  const totals = aggregate(values, f.project === 'all' ? allPlatform : allPlatform * share(scoped), periodDays)

  const byProject = new Map<string, RunValue[]>()
  for (const v of inPeriod.map((r) => evaluateRun(r, a))) byProject.set(v.record.project, [...(byProject.get(v.record.project) ?? []), v])
  const projects: ProjectRow[] = [...byProject].map(([project, list]) => ({
    project,
    sample: list.every((v) => v.record.sample),
    lastRun: Math.max(...list.map((v) => v.record.finishedAt)),
    ...aggregate(
      list,
      allPlatform * share(list.map((v) => v.record)),
      periodDays,
    ),
  }))
  projects.sort((x, y) => y.net - x.net)

  const agentMap = new Map<string, AgentRow & { latency: number }>()
  const tierMap = new Map<Exclude<ModelTier, 'none'>, { tokens: number; cost: number }>()
  for (const r of scoped)
    for (const u of r.usage) {
      const cur = agentMap.get(u.agent) ?? { agent: u.agent, tier: u.tier, calls: 0, tokens: 0, cost: 0, avgLatencyMs: 0, latency: 0 }
      cur.calls++
      cur.tokens += u.inputTokens + u.outputTokens
      cur.cost += usageCost(u, a)
      cur.latency += u.latencyMs
      agentMap.set(u.agent, cur)
      if (u.tier !== 'none') {
        const t = tierMap.get(u.tier) ?? { tokens: 0, cost: 0 }
        tierMap.set(u.tier, { tokens: t.tokens + u.inputTokens + u.outputTokens, cost: t.cost + usageCost(u, a) })
      }
    }
  const agents = [...agentMap.values()].map(({ latency, ...row }) => ({ ...row, avgLatencyMs: latency / row.calls })).sort((x, y) => y.cost - x.cost || y.tokens - x.tokens)
  const tiers = (['small', 'medium', 'large'] as const).map((tier) => ({ tier, ...(tierMap.get(tier) ?? { tokens: 0, cost: 0 }) }))

  const roles = ROLES.map((role) => ({ role, baseline: values.reduce((n, v) => n + v.baseline[role], 0), actual: values.reduce((n, v) => n + v.actual[role], 0) }))

  // Daily series: actual activity per day + cumulative value vs cumulative investment.
  const daily: DailyPoint[] = []
  const first = dayStart(f.from)
  const dailyPlatform = totals.platformCost / periodDays
  let cumValue = 0
  let cumInvestment = 0
  for (let d = first; d <= f.to; d += DAY) {
    const dayRows = values.filter((v) => dayStart(v.record.finishedAt) === d)
    const ai = dayRows.reduce((n, v) => n + v.aiCost, 0)
    const value = dayRows.reduce((n, v) => n + v.value, 0)
    cumValue += value
    cumInvestment += ai + dailyPlatform
    daily.push({ day: d, aiCost: ai, value, hoursSaved: dayRows.reduce((n, v) => n + v.hoursSaved, 0), runs: dayRows.length, cumValue, cumInvestment })
  }

  const complexity: Record<Complexity, number> = { simple: 0, medium: 0, complex: 0 }
  for (const v of values) if (v.built) complexity[v.record.complexity]++

  const limit = a.monthlyAiBudget * (periodDays / 30)
  return { periodDays, totals, projects, agents, tiers, roles, daily, complexity, budget: { limit, spent: totals.aiCost, used: limit > 0 ? totals.aiCost / limit : 0 } }
}

/** Screen complexity from the A2UI tree (non-layout nodes). */
export const complexityOf = (components: number): Complexity => (components <= 12 ? 'simple' : components <= 18 ? 'medium' : 'complex')

/** CSV of the per-project table (for finance / leadership decks). */
export function projectsCsv(rows: ProjectRow[]): string {
  const head = ['Project', 'Screens built', 'Runs', 'Avg quality', 'Review-ready', 'HITL decisions', 'Baseline hours', 'Actual hours', 'Hours saved', 'AI cost', 'Platform cost', 'Value', 'Net value', 'ROI']
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  const n = (v: number | null, d = 2) => (v == null ? '' : v.toFixed(d))
  return [
    head.join(','),
    ...rows.map((r) =>
      [q(r.project), r.screensBuilt, r.runs, n(r.avgQuality), n(r.reviewReadyRate), r.hitlDecisions, n(r.baselineHours, 1), n(r.actualHours, 1), n(r.hoursSaved, 1), n(r.aiCost), n(r.platformCost), n(r.value), n(r.net), n(r.roi)].join(','),
    ),
  ].join('\n')
}
