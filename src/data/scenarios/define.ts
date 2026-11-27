import type { A2uiComponent } from '@/types/a2ui'
import type { Row } from '@/types/datasource'
import type { Scenario, ScenarioPlan } from '@/types/scenario'

const WHY: Record<string, string> = {
  AavaCard: 'Section container',
  AavaHeading: 'Screen title',
  AavaText: 'Supporting copy',
  AavaTextField: 'Text input with validation',
  AavaButton: 'Primary / secondary actions',
  AavaCheckbox: 'Binary choice',
  AavaToggle: 'Preference switch',
  AavaSelect: 'Single choice from a list',
  AavaTable: 'Tabular records with status',
  AavaList: 'Repeating items from a collection',
  AavaStatCard: 'KPI tile with delta',
  AavaBarChart: 'Trend over time',
  AavaBadge: 'Status / label',
  AavaLink: 'Inline navigation',
  AavaDivider: 'Visual separator',
  AavaAvatar: 'User identity',
}

/** Shortlist the Component Matcher "retrieves" — derived from the components actually used. */
export function shortlistFor(components: A2uiComponent[]) {
  const names = [...new Set(components.map((c) => c.component).filter((n) => n.startsWith('Aava')))]
  return names.map((name, i) => ({ name, score: Math.round((0.97 - i * 0.02) * 100) / 100, why: WHY[name] ?? 'AAVA Play component' }))
}

type Defaults = 'shortlist' | 'altPlan' | 'responsive' | 'states' | 'contextPack' | 'figma' | 'quality' | 'fixes' | 'defects' | 'dataNeeds'
export type ScenarioInput = Omit<Scenario, Defaults> & Partial<Pick<Scenario, Defaults>>

/** Fills the boring parts of a scenario so each screen definition stays focused on its UI. */
export function defineScenario(s: ScenarioInput): Scenario {
  const altPlan: ScenarioPlan = s.altPlan ?? {
    summary: `Revised: a more compact ${s.title.toLowerCase()} with fewer sections above the fold.`,
    items: ['Merge secondary sections into one card', 'Primary action pinned to the top-right', 'Single column below 768px'],
  }
  return {
    ...s,
    shortlist: s.shortlist ?? shortlistFor(s.components),
    altPlan,
    responsive: s.responsive ?? ['≥ 1024px: multi-column grid', '768–1023px: two columns', '< 768px: single column, full-width actions'],
    states: s.states ?? ['Loading skeleton', 'Default', 'Empty', 'Error banner'],
    contextPack: s.contextPack ?? { tokens: 2900 + s.components.length * 40, budget: 4000, sources: ['Design Language', 'DS tokens', 'Lint rules', `Patterns KB: ${s.intent.screenType}`] },
    figma: s.figma ?? { frameName: s.title, nodeCount: 80 + s.components.length * 9, tokensMapped: 20 + s.components.length * 2, tokensFlagged: 2 },
    fixes: s.fixes ?? [],
    defects: s.defects ?? ['.card { padding: 18px; } // off the spacing scale'],
    dataNeeds: s.dataNeeds ?? [],
    quality: s.quality ?? [
      {
        dims: [0.82, 0.93, 0.86, 0.9, 0.87],
        lintErrors: 1,
        a11yCritical: 0,
        rawColours: 0,
        gaps: [{ el: '.card', prop: 'padding', found: '18px', expected: '--aava-space-4 (16px)', rule: 'DS-SPACE-01', fix: 'token', severity: 'soft', source: 'lint' }],
      },
      { dims: [0.96, 0.95, 0.92, 0.94, 0.89], lintErrors: 0, a11yCritical: 0, rawColours: 0, gaps: [] },
    ],
  }
}

// ---- helpers shared by scenario data mappers ----------------------------------
export const money = (n: unknown) => `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const str = (v: unknown) => (v == null ? '' : String(v))
export const pick = (rows: Row[], key: string) => rows.map((r) => str(r[key]))
export const c = (id: string, component: string, props: Record<string, unknown> = {}, children?: string[]): A2uiComponent => ({ id, component, ...props, ...(children ? { children } : {}) })
