/**
 * AAVA Play components for the A2UI renderer (registry lives in ./index.ts).
 * In the Angular product these map to @aava/play components; here they are
 * faithful React stand-ins styled only from theme tokens. The agent can only
 * reference names registered here — anything else renders as a blocked node.
 */
import { useId, type ComponentType, type ReactNode } from 'react'
import { Icon, isIconName } from '@/components/ui/Icon'
import type { A2uiComponent } from '@/types/a2ui'
import { cx } from '@/utils/format'
import s from './AavaPlay.module.scss'

export interface CatalogProps {
  node: A2uiComponent
  children?: ReactNode
  /** Resolve a literal or data-bound prop. */
  read: <T>(value: unknown, fallback: T) => T
  /** Write to the node's `value` binding. */
  write: (value: unknown) => void
  /** Raise the node's action back to the agent. */
  fire: (action: unknown) => void
}

export type CatalogComponent = ComponentType<CatalogProps>

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : v == null ? d : String(v))

export const Column: CatalogComponent = ({ node, children }) => (
  <div className={cx(s.column, s[`gap_${str(node.gap, 'md')}`], node.align === 'center' && s.center)} style={node.maxWidth ? { maxWidth: Number(node.maxWidth) } : undefined}>
    {children}
  </div>
)

export const Row: CatalogComponent = ({ node, children }) => <div className={cx(s.row, s[`justify_${str(node.justify, 'start')}`])}>{children}</div>

export const Grid: CatalogComponent = ({ node, children }) => <div className={cx(s.grid, s[`cols${Number(node.columns) || 2}`])}>{children}</div>

export const AavaCard: CatalogComponent = ({ node, children }) => (
  <section className={s.card}>
    {Boolean(node.title || node.subtitle) && (
      <header className={s.cardHead}>
        {node.title ? <h3 className={s.cardTitle}>{str(node.title)}</h3> : null}
        {node.subtitle ? <p className={s.cardSub}>{str(node.subtitle)}</p> : null}
      </header>
    )}
    <div className={s.cardBody}>{children}</div>
  </section>
)

export const AavaHeading: CatalogComponent = ({ node }) => {
  const level = Math.min(3, Math.max(1, Number(node.level) || 1))
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
  return <Tag className={cx(s.heading, s[`h${level}`])}>{str(node.text)}</Tag>
}

export const AavaText: CatalogComponent = ({ node }) => (
  <p className={cx(s.text, s[`tone_${str(node.tone, 'default')}`], s[`size_${str(node.size, 'md')}`], node.weight === 'strong' && s.strong, node.align === 'center' && s.alignCenter)}>{str(node.text)}</p>
)

export const AavaBadge: CatalogComponent = ({ node }) => <span className={cx(s.badge, s[`badge_${str(node.tone, 'neutral')}`])}>{str(node.text)}</span>

export const AavaTextField: CatalogComponent = ({ node, read, write }) => {
  const id = useId()
  const value = read<string>(node.value, '')
  const type = str(node.type, 'text')
  const invalid = type === 'email' && value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  const label = str(node.label)
  return (
    <div className={cx(s.field, invalid && s.invalid)}>
      {label && (
        <label className={cx(s.label, node.hideLabel ? 'sr-only' : undefined)} htmlFor={id}>
          {label}
          {node.required ? <span className={s.req}> *</span> : null}
        </label>
      )}
      <input
        id={id}
        className={s.input}
        type={type}
        placeholder={str(node.placeholder)}
        value={value}
        required={Boolean(node.required)}
        aria-invalid={invalid || undefined}
        onChange={(e) => write(e.target.value)}
      />
      {invalid && <span className={s.error}>Enter a valid email address</span>}
    </div>
  )
}

export const AavaCheckbox: CatalogComponent = ({ node, read, write }) => (
  <label className={s.check}>
    <input type="checkbox" checked={read<boolean>(node.value, false)} onChange={(e) => write(e.target.checked)} />
    <span className={s.checkBox} aria-hidden>
      <Icon name="check" size={12} strokeWidth={3} />
    </span>
    <span>{str(node.label)}</span>
  </label>
)

export const AavaToggle: CatalogComponent = ({ node, read, write }) => (
  <label className={s.toggle}>
    <span className={s.toggleText}>
      <span className={s.toggleLabel}>{str(node.label)}</span>
      {node.description ? <span className={s.toggleDesc}>{str(node.description)}</span> : null}
    </span>
    <input type="checkbox" role="switch" checked={read<boolean>(node.value, false)} onChange={(e) => write(e.target.checked)} />
    <span className={s.track} aria-hidden>
      <span />
    </span>
  </label>
)

export const AavaSelect: CatalogComponent = ({ node, read, write }) => {
  const id = useId()
  const options = Array.isArray(node.options) ? (node.options as string[]) : []
  return (
    <div className={s.field}>
      <label className={cx(s.label, node.hideLabel ? 'sr-only' : undefined)} htmlFor={id}>
        {str(node.label)}
      </label>
      <div className={s.selectWrap}>
        <select id={id} className={cx(s.input, s.select)} value={read<string>(node.value, options[0] ?? '')} onChange={(e) => write(e.target.value)}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <Icon name="chevronDown" size={14} className={s.selectIcon} />
      </div>
    </div>
  )
}

export const AavaButton: CatalogComponent = ({ node, fire }) => (
  <button type="button" className={cx(s.button, s[`btn_${str(node.variant, 'primary')}`], node.fullWidth ? s.full : undefined)} onClick={() => fire(node.action)}>
    {isIconName(node.icon) && <Icon name={node.icon} size={15} />}
    {str(node.label)}
  </button>
)

export const AavaLink: CatalogComponent = ({ node, fire }) => (
  <button type="button" className={s.link} onClick={() => fire(node.action)}>
    {str(node.text)}
  </button>
)

export const AavaDivider: CatalogComponent = ({ node }) => (
  <div className={s.divider} role="separator">
    {node.label ? <span>{str(node.label)}</span> : null}
  </div>
)

export const AavaAvatar: CatalogComponent = ({ node }) => {
  const name = str(node.name, '?')
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className={s.avatar} role="img" aria-label={name}>
      {initials}
    </span>
  )
}

export const AavaStatCard: CatalogComponent = ({ node }) => {
  const up = node.trend === 'up'
  return (
    <div className={s.stat} aria-label={node.srLabel ? str(node.srLabel) : undefined}>
      <span className={s.statLabel}>{str(node.label)}</span>
      <span className={s.statValue}>{str(node.value)}</span>
      <span className={cx(s.statDelta, node.sentiment === 'negative' ? s.neg : s.pos)}>
        <Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} strokeWidth={2.6} />
        {str(node.delta)}
        <span className={s.statPeriod}>vs prev.</span>
      </span>
    </div>
  )
}

export const AavaBarChart: CatalogComponent = ({ node }) => {
  const data = (Array.isArray(node.data) ? node.data : []) as { label: string; value: number }[]
  const max = Math.max(1, ...data.map((d) => d.value))
  const pre = str(node.valuePrefix)
  const suf = str(node.valueSuffix)
  const total = data.reduce((n, d) => n + d.value, 0)
  return (
    <figure className={s.chart} aria-label={`Bar chart, ${data.length} points, total ${pre}${total.toFixed(1)}${suf}`}>
      <div className={s.bars}>
        {data.map((d, i) => (
          <div key={d.label} className={s.barCol} title={`${d.label}: ${pre}${d.value}${suf}`}>
            <span className={s.barValue}>
              {pre}
              {Math.round(d.value)}
              {suf}
            </span>
            <span className={cx(s.bar, i === data.length - 1 && s.barLatest)} style={{ height: `${(d.value / max) * 100}%` }} />
            <span className={s.barLabel}>{d.label}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

const STATUS_TONE: Record<string, string> = { Paid: 'success', Pending: 'warning', Refunded: 'neutral', Failed: 'danger', Active: 'success', Invited: 'warning', Suspended: 'danger', Churned: 'neutral' }

export const AavaTable: CatalogComponent = ({ node, fire }) => {
  const columns = (Array.isArray(node.columns) ? node.columns : []) as { key: string; label: string; align?: 'end' }[]
  const rows = (Array.isArray(node.rows) ? node.rows : []) as Record<string, string>[]
  const statusKey = str(node.statusKey)
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'end' ? s.end : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={s.emptyCell}>
                No rows yet
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className={node.action ? s.clickable : undefined} onClick={node.action ? () => fire(node.action) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'end' ? s.end : undefined}>
                  {c.key === statusKey ? <span className={cx(s.badge, s[`badge_${STATUS_TONE[r[c.key]] ?? 'neutral'}`])}>{r[c.key]}</span> : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ListItem {
  title: string
  subtitle?: string
  meta?: string
  badge?: string
  tone?: string
  unread?: boolean
}

/** Repeating items from a collection — card grid (catalog) or row list (inbox, cart). */
export const AavaList: CatalogComponent = ({ node, fire }) => {
  const items = (Array.isArray(node.items) ? node.items : []) as ListItem[]
  const grid = node.variant === 'grid'
  if (!items.length) return <div className={s.emptyCell}>No items yet</div>
  return (
    <ul className={cx(grid ? s.listGrid : s.list)}>
      {items.map((it, i) => (
        <li key={i}>
          <button type="button" className={cx(s.listItem, it.unread && s.unread)} onClick={() => fire(node.action)} disabled={!node.action}>
            {grid && <span className={s.listThumb} aria-hidden>{it.title.slice(0, 1)}</span>}
            <span className={s.listBody}>
              <span className={s.listTitle}>
                {it.unread && <span className={s.unreadDot} aria-label="Unread" />}
                {it.title}
              </span>
              {it.subtitle && <span className={s.listSub}>{it.subtitle}</span>}
            </span>
            <span className={s.listAside}>
              {it.badge && <span className={cx(s.badge, s[`badge_${it.tone ?? 'neutral'}`])}>{it.badge}</span>}
              {it.meta && <span className={s.listMeta}>{it.meta}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
