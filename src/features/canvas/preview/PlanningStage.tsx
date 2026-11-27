import { useMemo } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { Icon } from '@/components/ui/Icon'
import { useIsMobile } from '@/hooks'
import type { StepName } from '@/types/run'
import { cx } from '@/utils/format'
import { LiveCode } from './LiveCode'
import { useBuildPhase } from './useBuildPhase'
import styles from './PlanningStage.module.scss'

const PLAN_STEPS: { name: StepName; label: string }[] = [
  { name: 'Sense', label: 'Reading intent' },
  { name: 'Match', label: 'Matching AAVA Play components' },
  { name: 'Mind', label: 'Loading rules, tokens & data' },
  { name: 'Think', label: 'Planning layout' },
]

/** Shown before the first A2UI node arrives: a blueprint assembles while the agent thinks. */
export function PlanningStage() {
  const { state, activeScreen } = useRun()
  const { waiting, interrupt } = useBuildPhase()
  const isMobile = useIsMobile()
  const title = activeScreen?.shared.title || 'your screen'

  const log = useMemo(() => {
    const lines: string[] = ['// AG-UI event stream · tool calls']
    for (const s of state.steps) {
      if (!s.toolCalls.length) continue
      lines.push(`// ${s.name}`)
      for (const t of s.toolCalls) lines.push(`${t.status === 'done' ? '✓' : '⟳'} ${t.name.padEnd(17)} ${t.result ?? '…'}`)
    }
    return lines.join('\n')
  }, [state.steps])

  return (
    <div className={styles.stage}>
      <div className={styles.blueprint} aria-hidden>
        <div className={styles.grid} />
        <div className={styles.sheet}>
          <span className={cx(styles.block, styles.b1)} />
          <span className={cx(styles.block, styles.b2)} />
          <div className={styles.row}>
            <span className={cx(styles.block, styles.b3)} />
            <span className={cx(styles.block, styles.b3)} />
            <span className={cx(styles.block, styles.b3)} />
          </div>
          <span className={cx(styles.block, styles.b4)} />
          <span className={cx(styles.block, styles.b5)} />
          <span className={cx(styles.block, styles.b6)} />
        </div>
        <div className={styles.beam} />
      </div>

      <div className={styles.info}>
        <span className={styles.eyebrow}>
          <span className={styles.pulse} /> Generating
        </span>
        <h3 className={styles.title}>Designing “{title}”</h3>
        <ol className={styles.steps}>
          {PLAN_STEPS.map((p) => {
            const st = state.steps.find((s) => s.name === p.name)?.status ?? 'pending'
            return (
              <li key={p.name} className={styles[st]}>
                <span className={styles.dot}>{st === 'done' || st === 'skipped' ? <Icon name="check" size={12} strokeWidth={3} /> : st === 'waiting' ? <Icon name="pause" size={10} /> : null}</span>
                <span>{p.label}</span>
              </li>
            )
          })}
        </ol>
        {waiting && interrupt?.kind === 'plan' && (
          <p className={styles.callout}>
            <Icon name="user" size={14} /> {isMobile ? 'Approve the plan below to start building.' : 'Approve the plan in the chat to start building.'}
          </p>
        )}
        <LiveCode text={log} typing title="agent.log" compact className={styles.log} />
      </div>
    </div>
  )
}
