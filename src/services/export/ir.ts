/**
 * Stack-neutral intermediate representation of a screen.
 * A2UI tree → IR (here) → JSX / Vue template / static HTML (render.ts).
 * Repeating collections (table rows, chart bars, list items, select options) are
 * `each` nodes over named collections, so generated code can load them live from the API.
 */
import { isBinding, type A2uiComponent } from '@/types/a2ui'
import type { ScreenState } from '@/types/project'

export type IRNode =
  | {
      k: 'el'
      tag: string
      cls?: string
      attrs?: Record<string, string | true>
      style?: Record<string, string>
      children?: IRNode[]
      /** Two-way binding to a flat model key ("user.email"). */
      model?: { key: string; kind: 'text' | 'checkbox' | 'select' }
      /** Action name raised on click (navigates when linked in the flow). */
      click?: string
      /** Class suffix taken from an item field: `${prefix}${item[path]}`. */
      dynCls?: { base: string; prefix: string; path: string }
      /** Inline style from an item field: height: `${item[path]}%`. */
      dynStyle?: { prop: string; path: string; unit: string }
      /** Render only when the item field is truthy. */
      when?: string
    }
  | { k: 'text'; value: string }
  | { k: 'expr'; path: string }
  | { k: 'each'; source: string; item: string; child: IRNode }

export interface ScreenSeed {
  model: Record<string, string | boolean>
  collections: Record<string, unknown[]>
}

export interface ScreenIR {
  root: IRNode
  seed: ScreenSeed
  /** Collections imported from a DB table → generated code fetches them live. */
  live: { id: string; table: string }[]
  actions: string[]
}

const STATUS_TONE: Record<string, string> = { Paid: 'success', Pending: 'warning', Refunded: 'neutral', Failed: 'danger', Active: 'success', Invited: 'warning', Suspended: 'danger', Churned: 'neutral' }

const key = (path: string) => path.replace(/^\//, '').replace(/\//g, '.')
const s = (v: unknown, d = '') => (v == null ? d : String(v))
const el = (tag: string, cls: string | undefined, children: IRNode[] = [], extra: Partial<Extract<IRNode, { k: 'el' }>> = {}): IRNode => ({ k: 'el', tag, cls, children, ...extra })
const text = (value: string): IRNode => ({ k: 'text', value })

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, p))
    else out[p] = typeof v === 'boolean' ? v : s(v)
  }
  return out
}

export function buildScreenIR(screen: ScreenState): ScreenIR {
  const nodes = screen.surface?.components ?? {}
  const collections: Record<string, unknown[]> = {}
  const actions = new Set<string>()
  const bound = new Map(screen.shared.bindings.filter((b) => b.prop !== 'props').map((b) => [b.componentId, b.table]))

  const act = (n: A2uiComponent) => {
    const name = (n.action as { event?: { name?: string } } | undefined)?.event?.name
    if (name) actions.add(name)
    return name
  }
  const modelKey = (n: A2uiComponent) => (isBinding(n.value) ? key(n.value.path) : n.id)

  const build = (id: string): IRNode => {
    const n = nodes[id]
    if (!n) return text('')
    const kids = (n.children ?? []).map(build)
    switch (n.component) {
      case 'Column':
        return el('div', ['stack', n.gap ? `stack--${n.gap}` : '', n.align === 'center' ? 'stack--center' : ''].filter(Boolean).join(' '), kids, n.maxWidth ? { style: { maxWidth: `${n.maxWidth}px` } } : {})
      case 'Row':
        return el('div', ['cluster', n.justify ? `cluster--${n.justify}` : ''].filter(Boolean).join(' '), kids)
      case 'Grid':
        return el('div', `grid grid--${n.columns ?? 2}`, kids)
      case 'AavaCard': {
        const head = n.title || n.subtitle ? [el('header', 'aava-card__head', [...(n.title ? [el('h3', 'aava-card__title', [text(s(n.title))])] : []), ...(n.subtitle ? [el('p', 'aava-card__sub', [text(s(n.subtitle))])] : [])])] : []
        return el('section', 'aava-card', [...head, el('div', 'aava-card__body', kids)])
      }
      case 'AavaHeading': {
        const lvl = Math.min(3, Math.max(1, Number(n.level) || 1))
        return el(`h${lvl}`, `aava-heading aava-h${lvl}`, [text(s(n.text))])
      }
      case 'AavaText':
        return el('p', ['aava-text', n.tone ? `aava-text--${n.tone}` : '', n.size === 'sm' ? 'aava-text--sm' : '', n.weight === 'strong' ? 'aava-text--strong' : '', n.align === 'center' ? 'aava-text--center' : ''].filter(Boolean).join(' '), [text(s(n.text))])
      case 'AavaBadge':
        return el('span', `aava-badge aava-badge--${s(n.tone, 'neutral')}`, [text(s(n.text))])
      case 'AavaTextField': {
        const fid = `f-${screen.slug}-${n.id}`
        const label = s(n.label)
        const attrs: Record<string, string | true> = { id: fid, type: s(n.type, 'text') }
        if (n.placeholder) attrs.placeholder = s(n.placeholder)
        if (n.required) attrs.required = true
        if (!label) attrs['aria-label'] = s(n.placeholder, n.id)
        return el('div', 'aava-field', [
          ...(label ? [el('label', n.hideLabel ? 'aava-label sr-only' : 'aava-label', [text(label), ...(n.required ? [el('span', 'aava-req', [text(' *')])] : [])], { attrs: { for: fid } })] : []),
          el('input', 'aava-input', [], { attrs, model: { key: modelKey(n), kind: 'text' } }),
        ])
      }
      case 'AavaCheckbox':
        return el('label', 'aava-check', [el('input', undefined, [], { attrs: { type: 'checkbox' }, model: { key: modelKey(n), kind: 'checkbox' } }), el('span', undefined, [text(s(n.label))])])
      case 'AavaToggle':
        return el('label', 'aava-toggle', [
          el('span', 'aava-toggle__text', [el('span', 'aava-toggle__label', [text(s(n.label))]), ...(n.description ? [el('span', 'aava-toggle__desc', [text(s(n.description))])] : [])]),
          el('input', 'aava-toggle__input', [], { attrs: { type: 'checkbox', role: 'switch' }, model: { key: modelKey(n), kind: 'checkbox' } }),
          el('span', 'aava-toggle__track', [], { attrs: { 'aria-hidden': 'true' } }),
        ])
      case 'AavaSelect': {
        const fid = `f-${screen.slug}-${n.id}`
        collections[n.id] = Array.isArray(n.options) ? n.options : []
        return el('div', 'aava-field', [
          el('label', n.hideLabel ? 'aava-label sr-only' : 'aava-label', [text(s(n.label))], { attrs: { for: fid } }),
          el('select', 'aava-input aava-select', [{ k: 'each', source: n.id, item: 'opt', child: el('option', undefined, [{ k: 'expr', path: 'opt' }]) }], { attrs: { id: fid }, model: { key: modelKey(n), kind: 'select' } }),
        ])
      }
      case 'AavaButton':
        return el('button', ['aava-btn', `aava-btn--${s(n.variant, 'primary')}`, n.fullWidth ? 'aava-btn--block' : ''].filter(Boolean).join(' '), [text(s(n.label))], { attrs: { type: 'button' }, click: act(n) })
      case 'AavaLink':
        return el('button', 'aava-link', [text(s(n.text))], { attrs: { type: 'button' }, click: act(n) })
      case 'AavaDivider':
        return el('div', 'aava-divider', n.label ? [el('span', undefined, [text(s(n.label))])] : [], { attrs: { role: 'separator' } })
      case 'AavaAvatar': {
        const name = s(n.name, '?')
        const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
        return el('span', 'aava-avatar', [text(initials)], { attrs: { role: 'img', 'aria-label': name } })
      }
      case 'AavaStatCard': {
        const up = n.trend === 'up'
        return el('div', 'aava-stat', [
          el('span', 'aava-stat__label', [text(s(n.label))]),
          el('span', 'aava-stat__value', [text(s(n.value))]),
          el('span', `aava-stat__delta aava-stat__delta--${n.sentiment === 'negative' ? 'neg' : 'pos'}`, [text(`${up ? '↑' : '↓'} ${s(n.delta)}`)]),
        ], n.srLabel ? { attrs: { 'aria-label': s(n.srLabel) } } : {})
      }
      case 'AavaBarChart': {
        const data = (Array.isArray(n.data) ? n.data : []) as { label: string; value: number }[]
        const max = Math.max(1, ...data.map((d) => d.value))
        collections[n.id] = data.map((d) => ({ label: d.label, value: d.value, _pct: Math.round((d.value / max) * 100), _value: `${s(n.valuePrefix)}${Math.round(d.value)}${s(n.valueSuffix)}` }))
        return el('figure', 'aava-chart', [
          el('div', 'aava-chart__bars', [
            {
              k: 'each',
              source: n.id,
              item: 'bar',
              child: el('div', 'aava-chart__col', [el('span', 'aava-chart__value', [{ k: 'expr', path: 'bar._value' }]), el('span', 'aava-chart__bar', [], { dynStyle: { prop: 'height', path: 'bar._pct', unit: '%' } }), el('span', 'aava-chart__label', [{ k: 'expr', path: 'bar.label' }])]),
            },
          ]),
        ], { attrs: { 'aria-label': `Bar chart, ${data.length} points` } })
      }
      case 'AavaTable': {
        const columns = (Array.isArray(n.columns) ? n.columns : []) as { key: string; label: string; align?: string }[]
        const statusKey = s(n.statusKey)
        const rows = (Array.isArray(n.rows) ? n.rows : []) as Record<string, string>[]
        collections[n.id] = rows.map((r) => ({ ...r, _tone: STATUS_TONE[r[statusKey]] ?? 'neutral' }))
        const click = act(n)
        return el('div', 'aava-table-wrap', [
          el('table', 'aava-table', [
            el('thead', undefined, [el('tr', undefined, columns.map((c) => el('th', c.align === 'end' ? 'is-end' : undefined, [text(c.label)])))]),
            el('tbody', undefined, [
              {
                k: 'each',
                source: n.id,
                item: 'row',
                child: el(
                  'tr',
                  click ? 'is-clickable' : undefined,
                  columns.map((c) =>
                    el('td', c.align === 'end' ? 'is-end' : undefined, [c.key === statusKey ? el('span', undefined, [{ k: 'expr', path: `row.${c.key}` }], { dynCls: { base: 'aava-badge', prefix: 'aava-badge--', path: 'row._tone' } }) : { k: 'expr', path: `row.${c.key}` }]),
                  ),
                  { click },
                ),
              },
            ]),
          ]),
        ])
      }
      case 'AavaList': {
        const grid = n.variant === 'grid'
        const items = (Array.isArray(n.items) ? n.items : []) as Record<string, unknown>[]
        collections[n.id] = items.map((it) => ({ title: s(it.title), subtitle: s(it.subtitle), meta: s(it.meta), badge: s(it.badge), tone: s(it.tone, 'neutral'), unread: Boolean(it.unread), _initial: s(it.title).slice(0, 1) }))
        const click = act(n)
        return el('ul', grid ? 'aava-list aava-list--grid' : 'aava-list', [
          {
            k: 'each',
            source: n.id,
            item: 'item',
            child: el('li', undefined, [
              el('button', 'aava-list__item', [
                ...(grid ? [el('span', 'aava-list__thumb', [{ k: 'expr', path: 'item._initial' } as IRNode], { attrs: { 'aria-hidden': 'true' } })] : []),
                el('span', 'aava-list__body', [
                  el('span', 'aava-list__title', [el('span', 'aava-dot', [], { when: 'item.unread', attrs: { 'aria-label': 'Unread' } }), { k: 'expr', path: 'item.title' }]),
                  el('span', 'aava-list__sub', [{ k: 'expr', path: 'item.subtitle' }], { when: 'item.subtitle' }),
                ]),
                el('span', 'aava-list__aside', [
                  el('span', undefined, [{ k: 'expr', path: 'item.badge' }], { when: 'item.badge', dynCls: { base: 'aava-badge', prefix: 'aava-badge--', path: 'item.tone' } }),
                  el('span', 'aava-list__meta', [{ k: 'expr', path: 'item.meta' }], { when: 'item.meta' }),
                ]),
              ], { attrs: { type: 'button' }, click }),
            ]),
          },
        ])
      }
      default:
        return el('div', 'aava-blocked', [text(`${n.component} is not part of the AAVA Play catalog`)], { attrs: { role: 'note' } })
    }
  }

  const root = build(screen.surface?.rootId ?? 'root')
  return {
    root,
    seed: { model: flatten(screen.surface?.dataModel ?? {}), collections },
    live: [...bound].filter(([id]) => id in collections).map(([id, table]) => ({ id, table })),
    actions: [...actions],
  }
}
