import type { Scenario } from '@/types/scenario'
import { toKebab } from '@/utils/format'
import { c, defineScenario } from './define'

const FILLER = /^(please|can|you|add|create|build|make|design|generate|give|me|new|another|a|an|the|one|more|screen|page|view|for|of|to|i|want|need)$/i

const FIELD_HINTS: { re: RegExp; field: Record<string, unknown> & { id: string } }[] = [
  { re: /\bname\b/, field: { id: 'name', label: 'Full name', required: true, value: { path: '/form/name' } } },
  { re: /\be-?mail\b/, field: { id: 'email', label: 'Email', type: 'email', required: true, value: { path: '/form/email' } } },
  { re: /\bphone|mobile\b/, field: { id: 'phone', label: 'Phone', type: 'tel', value: { path: '/form/phone' } } },
  { re: /\bcompany|organi[sz]ation\b/, field: { id: 'company', label: 'Company', value: { path: '/form/company' } } },
  { re: /\bsubject|topic\b/, field: { id: 'subject', label: 'Subject', value: { path: '/form/subject' } } },
  { re: /\baddress\b/, field: { id: 'address', label: 'Address', value: { path: '/form/address' } } },
  { re: /\bdate|when|schedule|book/, field: { id: 'date', label: 'Preferred date', type: 'date', value: { path: '/form/date' } } },
  { re: /\bmessage|comment|feedback|description|details\b/, field: { id: 'message', label: 'Message', value: { path: '/form/message' } } },
]

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase())

/** Derives a short screen title from a free-form prompt: "add a contact us page with email" → "Contact Us". */
export function titleFromPrompt(prompt: string): string {
  const head = prompt.toLowerCase().split(/\b(with|that|where|which|including|showing|containing|and)\b|[,.;:]/)[0] ?? prompt
  const words = head.split(/\s+/).filter((w) => w && !FILLER.test(w)).slice(0, 4)
  return titleCase(words.join(' ')) || 'New Screen'
}

/**
 * Fallback for prompts that match no built-in pattern: a form screen if the prompt
 * mentions fields, otherwise a simple content screen. Registered at runtime by id.
 */
export function buildGenericScenario(prompt: string): Scenario {
  const title = titleFromPrompt(prompt)
  const slug = toKebab(title.replace(/[^A-Za-z0-9 ]/g, '')).replace(/\s+/g, '-') || 'screen'
  const text = prompt.toLowerCase()
  const fields = FIELD_HINTS.filter((h) => h.re.test(text)).map((h) => h.field)
  const isForm = fields.length > 0

  const dataModel: Record<string, unknown> = isForm ? { form: Object.fromEntries(fields.map((f) => [f.id, ''])) } : {}
  const body = isForm
    ? [...fields.map((f) => f.id), 'actions']
    : ['intro', 'highlights', 'actions']

  return defineScenario({
    id: `generic-${slug}`,
    slug,
    title,
    suggestion: `Add a ${title.toLowerCase()} screen`,
    keywords: [],
    intent: { screenType: isForm ? 'generic/form' : 'generic/content', prompt, fields: fields.map((f) => f.id) },
    plan: {
      summary: isForm
        ? `Single card form with ${fields.length} field(s) and a primary submit action, built only from AAVA Play components.`
        : 'Content screen: heading, supporting copy, three highlight tiles and a primary action.',
      items: isForm
        ? ['Heading + helper text', ...fields.map((f) => `${f.label} field`), 'Primary submit + secondary cancel']
        : ['Heading + intro copy', '3 highlight tiles (3 → 1 columns)', 'Primary action'],
    },
    components: [
      c('root', 'Column', { gap: 'lg', maxWidth: isForm ? 560 : undefined, align: isForm ? 'center' : undefined }, ['header', 'card']),
      c('header', 'Column', { gap: 'sm' }, ['title', 'subtitle']),
      c('title', 'AavaHeading', { text: title, level: 1 }),
      c('subtitle', 'AavaText', { text: prompt.length > 140 ? `${prompt.slice(0, 137)}…` : prompt, tone: 'muted' }),
      c('card', 'AavaCard', { title: isForm ? 'Details' : undefined }, body),
      ...fields.map(({ id, ...props }) => c(id, 'AavaTextField', props)),
      ...(isForm
        ? []
        : [
            c('intro', 'AavaText', { text: 'Generated from your description. Refine any part in plain language — copy, layout or actions.' }),
            c('highlights', 'Grid', { columns: 3 }, ['h1', 'h2', 'h3']),
            c('h1', 'AavaStatCard', { label: 'Step 1', value: 'Plan', delta: 'approved', trend: 'up', sentiment: 'positive' }),
            c('h2', 'AavaStatCard', { label: 'Step 2', value: 'Build', delta: 'AAVA Play', trend: 'up', sentiment: 'positive' }),
            c('h3', 'AavaStatCard', { label: 'Step 3', value: 'Verify', delta: 'gated', trend: 'up', sentiment: 'positive' }),
          ]),
      c('actions', 'Row', { justify: 'end' }, ['cancel', 'submit']),
      c('cancel', 'AavaButton', { variant: 'ghost', label: 'Cancel', action: { event: { name: 'cancel' } } }),
      c('submit', 'AavaButton', { variant: 'primary', label: isForm ? 'Submit' : 'Continue', action: { event: { name: isForm ? 'submit' : 'continue' } } }),
    ].map((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as typeof x),
    dataModel,
  })
}
