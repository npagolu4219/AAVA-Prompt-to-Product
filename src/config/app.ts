import type { IconName } from '@/components/ui/Icon'
import type { QualityKey, RunOptions, StepName } from '@/types/run'

export const APP_NAME = 'AAVA Prompt-to-Product'

/** Keep in sync with $breakpoints in styles/abstracts/_breakpoints.scss */
export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const

export const STEP_NAMES: StepName[] = ['Sense', 'Match', 'Mind', 'Think', 'Act', 'Verify', 'Refine', 'Deliver']

/** A single conversation can build up to this many screens into one product flow. */
export const MAX_SCREENS = 10

export const STEP_META: Record<StepName, { icon: IconName; agent: string; output: string }> = {
  Sense: { icon: 'eye', agent: 'Intent & Context · Figma Ingest', output: 'Intent JSON' },
  Match: { icon: 'search', agent: 'Component Matcher', output: 'Component shortlist' },
  Mind: { icon: 'brain', agent: 'Rules & Memory', output: 'Context pack' },
  Think: { icon: 'bulb', agent: 'Layout Planner', output: 'Plan + HITL ①' },
  Act: { icon: 'wand', agent: 'A2UI Composer · Codegen', output: 'A2UI · code · spec' },
  Verify: { icon: 'shieldCheck', agent: 'Critic · Audit · Lint · Playwright', output: 'Score + gap report' },
  Refine: { icon: 'wrench', agent: 'Fixer', output: 'JSON patch · v(n+1)' },
  Deliver: { icon: 'rocket', agent: 'Project · Flow · Analysis', output: 'Screen saved · flow linked · code analysed' },
}

export const QUALITY_WEIGHTS: { key: QualityKey; label: string; weight: number }[] = [
  { key: 'tokens', label: 'Design-token compliance', weight: 0.25 },
  { key: 'components', label: 'Component conformance', weight: 0.2 },
  { key: 'visual', label: 'Visual fidelity (Playwright)', weight: 0.2 },
  { key: 'a11y', label: 'Accessibility (WCAG 2.2 AA)', weight: 0.2 },
  { key: 'critic', label: 'Critic (principles & UX)', weight: 0.15 },
]

export const THRESHOLDS = {
  deliver: 0.9,
  autofix: 0.75,
  maxIterations: 3,
} as const

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  autoApprovePlan: false,
  speed: 1,
}

export const STORAGE_KEYS = {
  theme: 'aava-p2p.theme.v1',
  runOptions: 'aava-p2p.run-options.v1',
  leftPaneStepsOpen: 'aava-p2p.steps-open.v1',
  dataSources: 'aava-p2p.data-sources.v1',
  deployments: 'aava-p2p.deployments.v1',
} as const

/** Set VITE_AGENT_URL to stream from a real AG-UI endpoint instead of the mock agent. */
export const AGENT_URL: string | undefined = import.meta.env.VITE_AGENT_URL || undefined

export const PROMPT_SUGGESTIONS = [
  'Login screen from Figma, AAVA theme, SSO option',
  'Revenue analytics dashboard with KPIs, weekly chart and recent orders',
  'Profile settings form with notification preferences',
]

export const PUBLISH_URL: string | undefined = import.meta.env.VITE_PUBLISH_URL || undefined

export const REFINE_SUGGESTIONS = [
  'Change the heading to "Welcome back"',
  'Make all buttons full width',
  'Make the main button secondary',
  'Remove the SSO button',
]
