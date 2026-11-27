import { useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { HitlChoice, Interrupt } from '@/types/run'
import { cx } from '@/utils/format'
import styles from './HitlCard.module.scss'

const DEFAULT_LABELS: Record<HitlChoice, string> = { approve: 'Approve', edit: 'Edit', reject: 'Reject' }
const CHECKPOINT = ['', '①', '②', '③']

interface Props {
  interrupt: Interrupt
  variant?: 'inline' | 'sheet'
}

/** Human-in-the-loop checkpoint raised by an AG-UI interrupt. */
export function HitlCard({ interrupt, variant = 'inline' }: Props) {
  const { resolve } = useRun()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [showDetails, setShowDetails] = useState(variant === 'sheet')
  const label = (c: HitlChoice) => interrupt.labels?.[c] ?? DEFAULT_LABELS[c]

  return (
    <section className={cx(styles.card, styles[interrupt.kind], styles[variant])} role="alertdialog" aria-labelledby={`${interrupt.id}-title`} aria-describedby={`${interrupt.id}-body`}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>
          <Icon name="user" size={12} strokeWidth={2.5} /> HITL {CHECKPOINT[interrupt.checkpoint]} · {interrupt.kind === 'plan' ? 'Plan approval' : interrupt.kind === 'final' ? 'Final sign-off' : 'Escalation'}
        </span>
        {interrupt.details?.length ? (
          <button type="button" className={styles.toggle} onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
            {showDetails ? 'Hide' : 'Details'} <Icon name={showDetails ? 'chevronUp' : 'chevronDown'} size={12} />
          </button>
        ) : null}
      </header>

      <h3 id={`${interrupt.id}-title`} className={styles.title}>
        {interrupt.title}
      </h3>
      <p id={`${interrupt.id}-body`} className={styles.body}>
        {interrupt.body}
      </p>

      {showDetails && interrupt.details && (
        <ul className={styles.details}>
          {interrupt.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}

      {editing ? (
        <form
          className={styles.editForm}
          onSubmit={(e) => {
            e.preventDefault()
            resolve('edit', note)
          }}
        >
          <label className="sr-only" htmlFor={`${interrupt.id}-note`}>
            Your change
          </label>
          <textarea
            id={`${interrupt.id}-note`}
            className={styles.note}
            autoFocus
            rows={2}
            placeholder="e.g. Use a single column on tablet as well"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) resolve('edit', note)
            }}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="sm" icon="check" disabled={!note.trim()}>
              Apply & continue
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          {interrupt.options.includes('approve') && (
            <Button variant="primary" size="sm" icon="check" onClick={() => resolve('approve')}>
              {label('approve')}
            </Button>
          )}
          {interrupt.options.includes('edit') && (
            <Button size="sm" icon="edit" onClick={() => setEditing(true)}>
              {label('edit')}
            </Button>
          )}
          {interrupt.options.includes('reject') && (
            <Button size="sm" variant="danger" icon="x" onClick={() => resolve('reject')}>
              {label('reject')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
