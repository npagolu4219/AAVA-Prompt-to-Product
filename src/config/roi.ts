import type { Assumptions } from '@/types/roi'

/**
 * Default assumptions for the business-value engine. They are *assumptions*, not facts:
 * every value is editable in ROI → Assumptions and persisted per device. Calibrate them
 * with real timesheets during the pilot (deck slide 30).
 */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  rates: { design: 70, dev: 75, qa: 55 },
  baselineHours: {
    simple: { design: 3, dev: 6, qa: 2 },
    medium: { design: 5, dev: 12, qa: 3 },
    complex: { design: 8, dev: 20, qa: 5 },
  },
  residualHours: {
    simple: { design: 0.25, dev: 1, qa: 0.5 },
    medium: { design: 0.5, dev: 2, qa: 0.75 },
    complex: { design: 0.75, dev: 4, qa: 1 },
  },
  refineBaselineHours: { design: 0.25, dev: 1, qa: 0.25 },
  baselineLeadDays: { simple: 3, medium: 5, complex: 8 },
  // Assumed list prices per 1M tokens for each model tier — replace with your contract rates.
  pricing: {
    small: { input: 1, output: 5, cachedInput: 0.1 },
    medium: { input: 3, output: 15, cachedInput: 0.3 },
    large: { input: 5, output: 25, cachedInput: 0.5 },
  },
  platformMonthlyCost: 400,
  implementationCost: 12000,
  amortisationMonths: 12,
  monthlyAiBudget: 150,
  defectCost: 180,
  baselineFirstPass: 0.62,
  tokensPerLoc: 12,
  regenLoops: 3,
  fullCodeContextTokens: 9000,
  hoursPerDay: 8,
}

/** Agent → model tier, per the deck's agent design (slide 14). */
export const AGENT_TIERS: Record<string, 'small' | 'medium' | 'large' | 'none'> = {
  'Intent & Context': 'small',
  'Figma Ingest': 'small',
  'Component Matcher': 'small',
  'Rules & Memory': 'small',
  'Layout Planner': 'large',
  'A2UI Composer': 'medium',
  'Angular Codegen': 'none',
  Critic: 'large',
  'Accessibility Audit': 'none',
  'Design Lint': 'none',
  'Playwright Verifier': 'none',
  Fixer: 'small',
}

export const ROI_STORAGE = {
  ledger: 'aava-p2p.roi-ledger.v1',
  assumptions: 'aava-p2p.roi-assumptions.v1',
  prefs: 'aava-p2p.roi-prefs.v1',
} as const
