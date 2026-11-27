/**
 * Context grounding for the mock agent: turns the run's resources (org codebase, Figma library,
 * docs, API specs, uploads) into tool calls + a `context_used` event the chat renders as chips.
 */
import type { ContextUse, ResourceRef } from '@/types/resources'
import type { Scenario } from '@/types/scenario'
import type { ScriptContext, ScriptHelpers } from './helpers'

const area = (sc: Scenario) => sc.intent.screenType.split('/')[0]

function codebaseHits(r: ResourceRef, sc: Scenario): string[] {
  const root = (r.config.paths || 'src/app/**').split(',')[0].replace(/\*.*$/, '').replace(/\/$/, '') || 'src/app'
  const a = area(sc)
  return [`${root}/${a}/${sc.slug}/${sc.slug}.component.ts`, `${root}/${a}/${a}.service.ts`, `${root}/shared/ui/page-header.component.ts`]
}

/** Sense/Mind: retrieve from each resource and report what was used. Returns a one-line summary. */
export async function groundOnResources(h: ScriptHelpers, ctx: ScriptContext, sc: Scenario, phase: 'sense' | 'mind'): Promise<ContextUse[]> {
  const used: ContextUse[] = []
  for (const r of ctx.input.resources) {
    const tag = r.mentioned ? ' (@mentioned)' : ''
    if (phase === 'sense' && r.kind === 'codebase') {
      const hits = codebaseHits(r, sc)
      await h.tool({ name: 'codebase.search', ms: 520, result: `${r.name}${tag} → ${hits.length} matches · ${hits[0]}` })
      used.push({ kind: r.kind, name: r.name, detail: `Reused naming & structure from ${hits[0].split('/').slice(-2).join('/')}` })
    }
    if (phase === 'sense' && r.kind === 'figma' && !ctx.input.figma) {
      await h.tool({ name: 'figma.library', ms: 440, result: `${r.name}${tag} · ${r.config.scope ?? 'Component library'} · matched ${sc.shortlist.length} components` })
      used.push({ kind: r.kind, name: r.name, detail: `${sc.shortlist.length} component variants matched` })
    }
    if (phase === 'mind' && (r.kind === 'design-system' || r.kind === 'docs' || r.kind === 'upload')) {
      const n = r.kind === 'upload' ? Math.max(1, Math.min(4, Math.ceil((r.excerpt?.length ?? 200) / 200))) : 3
      await h.tool({ name: 'docs.retrieve', ms: 380, result: `${r.name}${tag} → top-${n} passages` })
      const quote = r.excerpt?.replace(/\s+/g, ' ').trim().slice(0, 80)
      used.push({ kind: r.kind, name: r.name, detail: quote ? `“${quote}${(r.excerpt?.length ?? 0) > 80 ? '…' : ''}”` : `${n} passages on ${area(sc)} patterns` })
    }
    if (phase === 'mind' && r.kind === 'openapi') {
      const ep = sc.dataNeeds[0]?.table ?? area(sc)
      await h.tool({ name: 'openapi.match', ms: 360, result: `${r.name}${tag} → GET /${ep} · field names aligned` })
      used.push({ kind: r.kind, name: r.name, detail: `Bound to GET /${ep}` })
    }
  }
  if (used.length) ctx.emit({ type: 'CUSTOM', name: 'context_used', value: used })
  return used
}
