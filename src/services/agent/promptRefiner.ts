import { AGENT_URL } from '@/config/app'
import { findScenario } from '@/data/scenarios'
import { buildGenericScenario } from '@/data/scenarios/generic'
import { DEMO_TABLES } from '@/services/datasource/mockDatabase'
import type { TableSchema } from '@/types/datasource'
import type { Scenario } from '@/types/scenario'
import { abortError } from './types'

/**
 * Prompt refiner — turns a rough idea into a build-ready brief before a run starts.
 * Grounded in the same knowledge the agents use (matched screen pattern, its plan,
 * states and responsive rules, the connected database and enabled context), so the
 * refined prompt asks for things the pipeline can actually deliver.
 *
 * With VITE_AGENT_URL set it calls `POST {AGENT_URL}/refine`; otherwise (or on failure)
 * it refines locally and deterministically.
 */

export type RefineMode = 'enhance' | 'concise' | 'a11y' | 'data'

export interface RefineModeInfo {
  id: RefineMode
  label: string
  description: string
  icon: 'wand' | 'scissors' | 'accessibility' | 'database'
}

export const REFINE_MODES: RefineModeInfo[] = [
  { id: 'enhance', label: 'Enhance', description: 'Layout, components, states & responsive rules', icon: 'wand' },
  { id: 'concise', label: 'Make concise', description: 'One tight sentence, no filler', icon: 'scissors' },
  { id: 'a11y', label: 'Accessibility', description: 'WCAG 2.2 AA requirements', icon: 'accessibility' },
  { id: 'data', label: 'Bind to data', description: 'Wire screens to your database tables', icon: 'database' },
]

export interface RefineContext {
  /** Connected data source name, if any. */
  dbName?: string | null
  /** Enabled context resources (codebase, Figma, docs) as @handles. */
  handles: string[]
}

export interface RefineChange {
  label: string
  kind: 'pattern' | 'layout' | 'states' | 'responsive' | 'data' | 'a11y' | 'context' | 'trim' | 'guardrail'
}

export interface RefineResult {
  mode: RefineMode
  original: string
  text: string
  changes: RefineChange[]
  /** Screen pattern the brief was grounded in. */
  pattern: string
  source: 'agent' | 'local'
}

// ---------------------------------------------------------------------------------

const FILLER = /^(please\s+)?((can|could|would) you\s+)?(i\s+(want|need|would like)( you)? to\s+)?(please\s+)?(create|make|build|generate|design|give me|i want|i need)?\s*/i

/** Lower-case core of the idea: filler and trailing ellipses removed, single spaced. */
function core(prompt: string): string {
  // Refining a refined brief: keep only its first line's idea.
  const first = prompt.split('\n')[0].replace(/^[^—:]{2,40}\s[—:]\s/, '')
  return first
    .replace(FILLER, '')
    .replace(/(\.\.\.|…)+\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim()
}

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : '')

/** "Card: heading + supporting text, 24px…" → "card with heading + supporting text". */
const shortItem = (s: string) => {
  const [head, rest] = s.split(/:\s*/, 2)
  const detail = (rest ?? '').split(/[,(]/)[0].trim()
  return (detail ? `${head.toLowerCase()} (${detail})` : head.toLowerCase()).replace(/\s+/g, ' ')
}

function tablesFor(sc: Scenario, text: string): TableSchema[] {
  const fromScenario = sc.dataNeeds.map((d) => d.table)
  const mentioned = DEMO_TABLES.map((t) => t.schema.name).filter((n) => text.includes(n.replace(/_.*/, '')) || text.includes(n.replace(/s$/, '')))
  const names = [...new Set([...fromScenario, ...mentioned])]
  return names.map((n) => DEMO_TABLES.find((t) => t.schema.name === n)?.schema).filter((t): t is TableSchema => Boolean(t))
}

const tableLine = (t: TableSchema) => `${t.name} (${t.columns.filter((c) => !c.pk).slice(0, 5).map((c) => c.name).join(', ')})`

function pickScenario(prompt: string): Scenario {
  return findScenario(prompt) ?? buildGenericScenario(prompt)
}

/** Deterministic local refiner. Pure — safe to unit test. */
export function refinePromptLocal(prompt: string, mode: RefineMode, ctx: RefineContext): RefineResult {
  const sc = pickScenario(prompt)
  const idea = core(prompt) || sc.title.toLowerCase()
  const lower = prompt.toLowerCase()
  const changes: RefineChange[] = []
  const lines: string[] = []
  const tables = tablesFor(sc, lower)
  const db = ctx.dbName ?? null

  const dataLine = () => {
    if (!tables.length) return null
    changes.push({ label: `Bound to ${tables.map((t) => t.name).join(', ')}`, kind: 'data' })
    return `Data: ${db ? `bind to ${db} → ` : 'bind to '}${tables.map(tableLine).join('; ')}. Show loading skeletons and an empty state when there are no rows.`
  }
  const contextLine = () => {
    if (!ctx.handles.length) return null
    changes.push({ label: `${ctx.handles.length} context source${ctx.handles.length === 1 ? '' : 's'}`, kind: 'context' })
    return `Context: follow ${ctx.handles.map((h) => `@${h}`).join(' ')}.`
  }

  switch (mode) {
    case 'enhance': {
      lines.push(`${sc.title} — ${sentence(idea)}`)
      changes.push({ label: `${sc.title} pattern`, kind: 'pattern' })
      lines.push(`Layout: ${sc.plan.summary}`)
      const items = sc.plan.items.slice(0, 5).map(shortItem)
      if (items.length) {
        lines.push(`Include: ${items.join('; ')}.`)
        changes.push({ label: `${items.length} components`, kind: 'layout' })
      }
      if (sc.states.length) {
        lines.push(`States: ${sc.states.join(', ')}.`)
        changes.push({ label: `${sc.states.length} states`, kind: 'states' })
      }
      if (sc.responsive.length) {
        lines.push(`Responsive: ${sc.responsive.join('; ')}.`)
        changes.push({ label: 'Responsive rules', kind: 'responsive' })
      }
      const d = dataLine()
      if (d) lines.push(d)
      const c = contextLine()
      if (c) lines.push(c)
      lines.push('Constraints: AAVA Play components and design tokens only — no raw colours or spacing; WCAG 2.2 AA.')
      changes.push({ label: 'Design-system guardrails', kind: 'guardrail' })
      break
    }
    case 'concise': {
      const parts = sc.shortlist.slice(0, 3).map((s) => s.name.replace(/^Aava/, '').toLowerCase())
      const text = `${sc.title}: ${idea}${parts.length ? ` — ${parts.join(', ')}` : ''}, on-brand with AAVA Play.`
      lines.push(text.charAt(0).toUpperCase() + text.slice(1))
      const saved = prompt.trim().split(/\s+/).length - text.split(/\s+/).length
      changes.push({ label: saved > 0 ? `${saved} words trimmed` : 'Tightened wording', kind: 'trim' })
      changes.push({ label: `${sc.title} pattern`, kind: 'pattern' })
      break
    }
    case 'a11y': {
      lines.push(sentence(idea))
      const formy = /form|login|sign|password|checkout|settings|account|input|field/.test(lower + sc.title.toLowerCase())
      const reqs = [
        'every control has a visible label (no placeholder-only fields)',
        'visible focus rings and a logical tab order that matches the visual order',
        'text contrast ≥ 4.5:1 and touch targets ≥ 44px',
        formy ? 'inline errors linked with aria-describedby and announced via aria-live' : 'status changes announced via aria-live',
        'one h1 with sequential headings and landmark regions',
        'respects prefers-reduced-motion',
      ]
      lines.push(`Accessibility (WCAG 2.2 AA): ${reqs.join('; ')}.`)
      changes.push({ label: `${reqs.length} WCAG 2.2 AA rules`, kind: 'a11y' })
      if (formy) changes.push({ label: 'Accessible form errors', kind: 'a11y' })
      break
    }
    case 'data': {
      lines.push(sentence(idea))
      const d = dataLine()
      if (d) lines.push(d)
      else {
        lines.push(`Data: ${db ? `use ${db}; ` : ''}model the fields this screen needs and show loading, empty and error states.`)
        changes.push({ label: 'Data states', kind: 'data' })
      }
      const c = contextLine()
      if (c) lines.push(c)
      break
    }
  }

  return { mode, original: prompt, text: lines.join('\n'), changes, pattern: sc.title, source: 'local' }
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(abortError())), { once: true })
  })

/** Refine via the agent backend when configured; local fallback otherwise. */
export async function refinePrompt(prompt: string, mode: RefineMode, ctx: RefineContext, signal?: AbortSignal): Promise<RefineResult> {
  if (AGENT_URL) {
    try {
      const res = await fetch(`${AGENT_URL.replace(/\/$/, '')}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, context: ctx }),
        signal,
      })
      if (res.ok) {
        const body = (await res.json()) as Partial<RefineResult>
        if (typeof body.text === 'string' && body.text.trim()) {
          return { mode, original: prompt, text: body.text, changes: body.changes ?? [], pattern: body.pattern ?? '', source: 'agent' }
        }
      }
    } catch (e) {
      if (signal?.aborted) throw e
    }
  }
  // Mock latency so the "thinking" state reads as real work.
  await wait(650 + Math.min(500, prompt.length * 4), signal)
  return refinePromptLocal(prompt, mode, ctx)
}
