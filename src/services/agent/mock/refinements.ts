import type { A2uiComponent } from '@/types/a2ui'
import type { JsonPatchOp } from '@/types/agui'

export interface RefinementResult {
  components: A2uiComponent[]
  changed: A2uiComponent[]
  ops: JsonPatchOp[]
  notes: string[]
}

/**
 * Deterministic "Fixer" for follow-up prompts in refine mode.
 * Maps plain-language requests onto targeted JSON-Patch operations on the A2UI tree
 * instead of regenerating the screen.
 */
export function applyRefinement(source: A2uiComponent[], prompt: string): RefinementResult {
  const components = structuredClone(source)
  const byId = new Map(components.map((c, i) => [c.id, { c, i }]))
  const changedIds = new Set<string>()
  const ops: JsonPatchOp[] = []
  const notes: string[] = []
  const text = prompt.toLowerCase()

  const set = (c: A2uiComponent, prop: string, value: unknown) => {
    if (c[prop] === value) return
    c[prop] = value
    changedIds.add(c.id)
    ops.push({ op: 'replace', path: `/components/${byId.get(c.id)!.i}/${prop}`, value })
  }

  // 1. Quoted text → heading copy
  const quoted = prompt.match(/["“'‘]([^"”'’]{2,60})["”'’]/)
  if (quoted && /(heading|title|header|headline)/.test(text)) {
    const heading = components.find((c) => c.component === 'AavaHeading')
    if (heading) {
      set(heading, 'text', quoted[1])
      notes.push(`Heading → “${quoted[1]}”`)
    }
  }

  // 2. Full-width buttons
  if (/full[\s-]?width/.test(text)) {
    components.filter((c) => c.component === 'AavaButton').forEach((b) => set(b, 'fullWidth', true))
    notes.push('Buttons set to full width')
  }

  // 3. Primary action variant
  const variant = /\bsecondary\b/.test(text) ? 'secondary' : /\bghost\b/.test(text) ? 'ghost' : /\bprimary\b/.test(text) ? 'primary' : null
  if (variant && /(button|cta|action)/.test(text)) {
    const cta = components.find((c) => c.component === 'AavaButton' && (c.variant === 'primary' || c.id === 'cta' || c.id === 'save'))
    if (cta) {
      set(cta, 'variant', variant)
      notes.push(`Main action variant → ${variant}`)
    }
  }

  // 4. Remove an element by id or label ("remove the SSO button")
  const removeMatch = text.match(/\b(remove|delete|hide|drop)\s+(?:the\s+)?([a-z0-9 ]+?)(?:\s+(button|field|link|card|section|toggle))?$/)
  if (removeMatch) {
    const term = removeMatch[2].trim()
    const target = components.find(
      (c) => c.id !== 'root' && (c.id.toLowerCase() === term || String(c.label ?? c.text ?? c.title ?? '').toLowerCase().includes(term)),
    )
    if (target) {
      for (const parent of components) {
        const idx = parent.children?.indexOf(target.id) ?? -1
        if (idx >= 0) {
          parent.children = parent.children!.filter((id) => id !== target.id)
          changedIds.add(parent.id)
          ops.push({ op: 'remove', path: `/components/${byId.get(parent.id)!.i}/children/${idx}` })
        }
      }
      notes.push(`Removed \`${target.id}\` (${target.component})`)
    }
  }

  return { components, changed: components.filter((c) => changedIds.has(c.id)), ops, notes }
}
