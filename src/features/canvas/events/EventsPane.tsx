import { useMemo, useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { useAutoScroll } from '@/hooks'
import type { EventCategory } from '@/types/agui'
import { cx } from '@/utils/format'
import styles from './EventsPane.module.scss'

const CATEGORIES: { id: EventCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'text', label: 'Text' },
  { id: 'tool', label: 'Tool' },
  { id: 'state', label: 'State' },
  { id: 'custom', label: 'Custom' },
]

/** Raw AG-UI event stream — useful for demos and debugging the BFF adapter. */
export function EventsPane() {
  const { state } = useRun()
  const [filter, setFilter] = useState<EventCategory | 'all'>('all')
  const [hideTokens, setHideTokens] = useState(true)
  const [open, setOpen] = useState<number | null>(null)

  const events = useMemo(
    () => state.events.filter((e) => (filter === 'all' || e.category === filter) && !(hideTokens && e.type === 'TEXT_MESSAGE_CONTENT')),
    [state.events, filter, hideTokens],
  )
  const ref = useAutoScroll<HTMLOListElement>(events.length)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.events.length }
    for (const e of state.events) c[e.category] = (c[e.category] ?? 0) + 1
    return c
  }, [state.events])

  if (!state.events.length) {
    return <EmptyState icon="activity" title="No events yet" description="Every AG-UI event of the current run — lifecycle, text, tool calls, state deltas, A2UI and interrupts — appears here in order." />
  }

  const t0 = state.events[0].at

  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="toolbar" aria-label="Filter events">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={cx(styles.filter, filter === c.id && styles.filterOn, styles[c.id])} onClick={() => setFilter(c.id)} aria-pressed={filter === c.id}>
              {c.label}
              <span className={styles.count}>{counts[c.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className={styles.tokens}>
          <input type="checkbox" checked={hideTokens} onChange={(e) => setHideTokens(e.target.checked)} />
          Hide token deltas
        </label>
      </div>

      <ol ref={ref} className={styles.list}>
        {events.map((e) => (
          <li key={e.id} className={cx(styles.event, styles[e.category])}>
            <button type="button" className={styles.row} onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span className={styles.time}>+{((e.at - t0) / 1000).toFixed(2)}s</span>
              <span className={styles.type}>{e.payload.type === 'CUSTOM' ? `CUSTOM · ${e.payload.name}` : e.type}</span>
              <span className={styles.label}>{e.label}</span>
              <Icon name={open === e.id ? 'chevronUp' : 'chevronDown'} size={13} className={styles.chev} />
            </button>
            {open === e.id && <pre className={styles.payload}>{JSON.stringify(e.payload, null, 2)}</pre>}
          </li>
        ))}
      </ol>
    </div>
  )
}
