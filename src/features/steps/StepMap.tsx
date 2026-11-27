import { useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { Icon } from '@/components/ui/Icon'
import { STEP_META } from '@/config/app'
import { useTicker } from '@/hooks'
import type { StepState, StepStatus } from '@/types/run'
import { cx, formatDuration } from '@/utils/format'
import styles from './StepMap.module.scss'

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  waiting: 'Waiting for you',
  done: 'Done',
  skipped: 'Skipped',
  error: 'Stopped',
}

interface Props {
  variant?: 'compact' | 'full'
}

/** Live Sense → Refine pipeline, driven by AG-UI STEP_* and TOOL_CALL_* events. */
export function StepMap({ variant = 'compact' }: Props) {
  const { state } = useRun()
  const active = state.status === 'running' || state.status === 'waiting'
  useTicker(active, 200)
  const done = state.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length
  const progress = Math.round((done / state.steps.length) * 100)

  return (
    <section className={cx(styles.map, styles[variant])} aria-label="Step map">
      <div className={styles.progress} aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>
      <ol className={styles.list}>
        {state.steps.map((step, i) => (
          <StepRow key={step.name} step={step} index={i} defaultOpen={variant === 'full'} />
        ))}
      </ol>
    </section>
  )
}

function StepRow({ step, index, defaultOpen }: { step: StepState; index: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null)
  const meta = STEP_META[step.name]
  const isLive = step.status === 'running' || step.status === 'waiting'
  const expanded = open ?? (defaultOpen ? step.toolCalls.length > 0 : isLive)
  const duration = step.startedAt ? (step.endedAt ?? Date.now()) - step.startedAt : 0
  const hasDetail = step.toolCalls.length > 0 || Boolean(step.summary)

  return (
    <li className={cx(styles.step, styles[step.status])}>
      <button type="button" className={styles.head} onClick={() => hasDetail && setOpen(!expanded)} aria-expanded={hasDetail ? expanded : undefined} disabled={!hasDetail}>
        <span className={styles.node} aria-hidden>
          {step.status === 'done' ? (
            <Icon name="check" size={13} strokeWidth={3} />
          ) : step.status === 'skipped' ? (
            <Icon name="skip" size={11} />
          ) : step.status === 'waiting' ? (
            <Icon name="pause" size={11} />
          ) : step.status === 'error' ? (
            <Icon name="x" size={12} strokeWidth={3} />
          ) : (
            <span className={styles.num}>{index + 1}</span>
          )}
        </span>
        <span className={styles.meta}>
          <span className={styles.titleRow}>
            <Icon name={meta.icon} size={14} className={styles.stepIcon} />
            <span className={styles.name}>{step.name}</span>
            {step.iterations > 1 && <span className={styles.iter}>×{step.iterations}</span>}
            <span className={styles.state}>{STATUS_LABEL[step.status]}</span>
          </span>
          <span className={styles.summary}>{step.summary ?? meta.agent}</span>
        </span>
        <span className={styles.time}>{duration > 0 ? formatDuration(duration) : ''}</span>
        {hasDetail && <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} className={styles.chev} />}
      </button>

      {expanded && step.toolCalls.length > 0 && (
        <ul className={styles.tools}>
          {step.toolCalls.map((t) => (
            <li key={t.id} className={cx(styles.tool, t.status === 'running' && styles.toolRunning)}>
              <span className={styles.toolDot} aria-hidden />
              <code className={styles.toolName}>{t.name}</code>
              <span className={styles.toolResult}>{t.status === 'running' ? 'running…' : t.result}</span>
              {t.endedAt && <span className={styles.toolTime}>{formatDuration(t.endedAt - t.startedAt)}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
