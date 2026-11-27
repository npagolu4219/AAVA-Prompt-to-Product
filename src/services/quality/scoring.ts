import { QUALITY_WEIGHTS, THRESHOLDS } from '@/config/app'
import type { GateDecision, QualityReport } from '@/types/run'
import type { QualityInput } from '@/types/scenario'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Gate logic (slide 13/16):
 *  ≥ 0.90 and zero hard-gate failures → deliver
 *  < 0.75                             → escalate to HITL ③
 *  otherwise                          → auto-fix (max 3 iterations, then escalate)
 */
export function decide(score: number, hardGatesPass: boolean, iteration: number): GateDecision {
  if (score >= THRESHOLDS.deliver && hardGatesPass) return 'deliver'
  if (score < THRESHOLDS.autofix) return 'escalate'
  return iteration >= THRESHOLDS.maxIterations ? 'escalate' : 'autofix'
}

export function buildQuality(input: QualityInput, iteration: number, history: number[]): QualityReport {
  const dimensions = QUALITY_WEIGHTS.map((w, i) => ({ ...w, score: input.dims[i] }))
  const score = round2(dimensions.reduce((sum, d) => sum + d.weight * d.score, 0))
  const hardGates = [
    { label: '0 Design-Linter errors', passed: input.lintErrors === 0 },
    { label: '0 critical / serious axe violations', passed: input.a11yCritical === 0 },
    { label: 'No unmapped raw colour values', passed: input.rawColours === 0 },
  ]
  const pass = hardGates.every((g) => g.passed)
  return {
    score,
    iteration,
    dimensions,
    gaps: input.gaps,
    hardGates,
    lintErrors: input.lintErrors,
    a11yCritical: input.a11yCritical,
    decision: decide(score, pass, iteration),
    history: [...history, score],
  }
}

export const DECISION_COPY: Record<GateDecision, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  deliver: { label: 'Pass → final sign-off', tone: 'success' },
  autofix: { label: 'Auto-fix loop', tone: 'warning' },
  escalate: { label: 'Escalate to HITL ③', tone: 'danger' },
}
