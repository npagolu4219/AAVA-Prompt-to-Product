import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/utils/format'
import { Icon, type IconName } from './Icon'
import styles from './Tabs.module.scss'

export interface TabItem<T extends string> {
  id: T
  label: string
  icon?: IconName
  badge?: ReactNode
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  idPrefix: string
  actions?: ReactNode
}

/** WAI-ARIA tablist with roving focus (←/→/Home/End). Horizontal scroll on narrow screens. */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, actions }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = items.length - 1
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1
    if (next < 0) return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className={styles.bar}>
      <div role="tablist" aria-label={label} className={styles.list}>
        {items.map((t, i) => {
          const selected = t.id === value
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              role="tab"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={cx(styles.tab, selected && styles.selected)}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.icon && <Icon name={t.icon} size={15} />}
              <span>{t.label}</span>
              {t.badge}
            </button>
          )
        })}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
