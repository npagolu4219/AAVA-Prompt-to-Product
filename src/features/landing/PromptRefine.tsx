import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { REFINE_MODES, type RefineChange, type RefineMode, type RefineResult } from '@/services/agent/promptRefiner'
import { cx } from '@/utils/format'
import type { RefinePhase } from './usePromptRefiner'
import styles from './PromptRefine.module.scss'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const REFINE_SHORTCUT = isMac ? '⌘I' : 'Ctrl+I'

interface ButtonProps {
  phase: RefinePhase
  mode: RefineMode | null
  disabled: boolean
  onRefine: (m: RefineMode) => void
  onCancel: () => void
}

/** Wand button: click opens the mode menu; while working it shows progress and cancels on click. */
export function RefineButton({ phase, mode, disabled, onRefine, onCancel }: ButtonProps) {
  const [open, setOpen] = useState(false)
  const [burst, setBurst] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const busy = phase === 'thinking' || phase === 'streaming'
  const prev = useRef(phase)

  // Sparkle burst when a refinement lands.
  useEffect(() => {
    if (prev.current === 'streaming' && phase === 'done') setBurst((b) => b + 1)
    prev.current = phase
  }, [phase])

  useEffect(() => {
    if (!open) return
    items.current[0]?.focus()
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (m: RefineMode) => {
    setOpen(false)
    onRefine(m)
  }

  const onMenuKey = (e: KeyboardEvent) => {
    const idx = items.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      root.current?.querySelector<HTMLButtonElement>('button')?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = REFINE_MODES.length
      items.current[(idx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus()
    } else if (/^[1-4]$/.test(e.key)) {
      pick(REFINE_MODES[Number(e.key) - 1].id)
    }
  }

  const label = REFINE_MODES.find((m) => m.id === mode)?.label

  return (
    <div ref={root} className={styles.root}>
      <button
        type="button"
        className={cx(styles.btn, busy && styles.btnBusy, open && styles.btnOpen)}
        onClick={() => (busy ? onCancel() : setOpen((v) => !v))}
        disabled={disabled && !busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title={busy ? 'Stop refining' : disabled ? 'Type an idea first, then refine it' : `Refine prompt (${REFINE_SHORTCUT})`}
      >
        <span className={styles.wand} aria-hidden>
          <Icon name="wand" size={15} strokeWidth={2.2} />
          <i className={styles.spark} />
          <i className={styles.spark} />
          <i className={styles.spark} />
        </span>
        <span className={styles.btnLabel} aria-live="polite">
          {phase === 'thinking' ? 'Refining…' : phase === 'streaming' ? `${label}…` : 'Refine'}
        </span>
        {busy && <span className={styles.stop} aria-label="Stop" />}
        {burst > 0 && (
          <span key={burst} className={styles.burst} aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ ['--a' as string]: `${i * 45}deg` } as CSSProperties} />
            ))}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Refine prompt" onKeyDown={onMenuKey}>
          <div className={styles.menuHead}>
            <Icon name="sparkles" size={13} /> Refine with AAVA
          </div>
          {REFINE_MODES.map((m, i) => (
            <button
              key={m.id}
              ref={(el) => {
                items.current[i] = el
              }}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              style={{ ['--i' as string]: i } as CSSProperties}
              onClick={() => pick(m.id)}
            >
              <span className={cx(styles.menuIcon, styles[`tone_${m.id}`])}>
                <Icon name={m.icon} size={15} />
              </span>
              <span className={styles.menuText}>
                <strong>{m.label}</strong>
                <span>{m.description}</span>
              </span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const KIND_ICON: Record<RefineChange['kind'], IconName> = {
  pattern: 'layout',
  layout: 'grid',
  states: 'layers',
  responsive: 'phone',
  data: 'database',
  a11y: 'accessibility',
  context: 'book',
  trim: 'scissors',
  guardrail: 'shieldCheck',
}

interface SummaryProps {
  result: RefineResult
  phase: RefinePhase
  onUndo: () => void
  onAgain: () => void
  onDismiss: () => void
}

/** Strip under the field: what the refinement added, with undo. */
export function RefineSummary({ result, phase, onUndo, onAgain, onDismiss }: SummaryProps) {
  const ready = phase === 'done'
  return (
    <div className={cx(styles.summary, ready && styles.summaryReady)} role="status">
      <span className={styles.summaryTitle}>
        <Icon name={ready ? 'check' : 'sparkles'} size={13} strokeWidth={2.6} />
        {ready ? 'Refined' : 'Writing'} · {result.pattern || 'brief'}
      </span>
      <ul className={styles.changes}>
        {result.changes.map((c, i) => (
          <li key={c.label} style={{ ['--i' as string]: i } as CSSProperties}>
            <Icon name={KIND_ICON[c.kind]} size={11} />
            {c.label}
          </li>
        ))}
      </ul>
      {ready && (
        <span className={styles.actions}>
          <button type="button" onClick={onUndo}>
            <Icon name="undo" size={13} /> Undo
          </button>
          <button type="button" onClick={onAgain}>
            <Icon name="refresh" size={13} /> Again
          </button>
          <button type="button" className={styles.x} onClick={onDismiss} aria-label="Dismiss">
            <Icon name="x" size={13} />
          </button>
        </span>
      )}
    </div>
  )
}
