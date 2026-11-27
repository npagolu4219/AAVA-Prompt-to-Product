import type { A2uiComponent } from '@/types/a2ui'
import type { Row } from '@/types/datasource'
import type { ScreenState } from '@/types/project'
import type { CollectionBinding } from '@/types/run'

export type BindableProp = Exclude<CollectionBinding['prop'], 'props'>

export interface Bindable {
  id: string
  component: string
  prop: BindableProp
  label: string
}

/** Default target order: the component a table most likely feeds. */
const PRIORITY = ['AavaTable', 'AavaList', 'AavaBarChart', 'AavaSelect']

/** Collection-shaped props a table can be imported into. */
const PROP_FOR: Record<string, BindableProp> = { AavaTable: 'rows', AavaBarChart: 'data', AavaList: 'items', AavaSelect: 'options' }

export function bindableComponents(screen: ScreenState | null): Bindable[] {
  return Object.values(screen?.surface?.components ?? {})
    .filter((c) => PROP_FOR[c.component])
    .sort((a, b) => PRIORITY.indexOf(a.component) - PRIORITY.indexOf(b.component))
    .map((c) => ({ id: c.id, component: c.component, prop: PROP_FOR[c.component], label: String(c.label ?? c.title ?? c.id) }))
}

export interface ColumnMapping {
  /** Table: columns to show. */
  columns: string[]
  /** Chart/List/Select: label column. */
  label?: string
  /** Chart: numeric column · List: subtitle column. */
  value?: string
  /** List: right-hand meta column. */
  meta?: string
}

const title = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
const show = (v: unknown) => (v == null ? '' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v))

/** Maps query rows onto the target component's prop(s) — deterministic, no LLM involved. */
export function mapRowsToComponent(node: A2uiComponent, prop: BindableProp, rows: Row[], m: ColumnMapping): A2uiComponent {
  switch (prop) {
    case 'rows': {
      const cols = m.columns.length ? m.columns : Object.keys(rows[0] ?? {})
      return {
        ...node,
        columns: cols.map((key) => ({ key, label: title(key), ...(typeof rows[0]?.[key] === 'number' ? { align: 'end' } : {}) })),
        rows: rows.map((r) => Object.fromEntries(cols.map((k) => [k, show(r[k])]))),
        statusKey: cols.includes('status') ? 'status' : undefined,
      }
    }
    case 'data':
      return { ...node, data: rows.map((r) => ({ label: show(r[m.label ?? '']), value: Number(r[m.value ?? '']) || 0 })), valuePrefix: '', valueSuffix: '' }
    case 'items':
      return { ...node, items: rows.map((r) => ({ title: show(r[m.label ?? '']), subtitle: m.value ? show(r[m.value]) : undefined, meta: m.meta ? show(r[m.meta]) : undefined })) }
    case 'options':
      return { ...node, options: [...new Set(rows.map((r) => show(r[m.label ?? ''])))].filter(Boolean) }
  }
}
