import { useRun } from '@/app/providers/RunProvider'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { THRESHOLDS } from '@/config/app'
import { DECISION_COPY } from '@/services/quality/scoring'
import type { Gap, Verifier } from '@/types/run'
import { cx } from '@/utils/format'
import styles from './QualityPane.module.scss'

const SOURCE_LABEL: Record<Verifier, string> = { critic: 'Critic', audit: 'a11y Audit', lint: 'Design Lint', playwright: 'Playwright' }
const SOURCE_TONE: Record<Verifier, BadgeTone> = { critic: 'accent', audit: 'info', lint: 'primary', playwright: 'neutral' }

const BANDS = [
  { range: `≥ ${THRESHOLDS.deliver.toFixed(2)}`, label: 'Pass → HITL ② final sign-off', tone: 'pass' },
  { range: `${THRESHOLDS.autofix.toFixed(2)} – ${THRESHOLDS.deliver.toFixed(2)}`, label: `Auto-fix loop (max ${THRESHOLDS.maxIterations}), re-verify changed regions`, tone: 'warn' },
  { range: `< ${THRESHOLDS.autofix.toFixed(2)}`, label: 'Escalate to HITL ③ with diff & options', tone: 'fail' },
] as const

const PRECEDENCE = ['Deterministic rules — linter & a11y blockers always win', 'Source of truth — spec doc / Figma values', 'Design Language — critic principle findings', 'Human override — HITL decision, rationale logged']

/** Weighted score, hard gates, gap report and iteration history. */
export function QualityPane() {
  const { activeScreen } = useRun()
  const q = activeScreen?.shared.quality ?? null

  if (!q) {
    return (
      <EmptyState
        icon="shieldCheck"
        title="Not verified yet"
        description="Critic, Accessibility Audit, Design Lint and Playwright run in parallel after codegen. Their findings merge into one weighted score here."
      />
    )
  }

  const band = q.score >= THRESHOLDS.deliver ? 'pass' : q.score >= THRESHOLDS.autofix ? 'warn' : 'fail'
  const decision = DECISION_COPY[q.decision]

  return (
    <div className={styles.pane}>
      <div className={styles.grid}>
        {/* Score */}
        <section className={cx(styles.card, styles.scoreCard)}>
          <ScoreRing score={q.score} size={132} />
          <div className={styles.scoreMeta}>
            <span className={styles.eyebrow}>Iteration {q.iteration}</span>
            <Badge tone={decision.tone} icon={q.decision === 'deliver' ? 'check' : q.decision === 'autofix' ? 'wrench' : 'user'}>
              {decision.label}
            </Badge>
            <div className={styles.history} aria-label="Score history">
              {q.history.map((h, i) => (
                <span key={i} className={styles.historyItem}>
                  {i > 0 && <Icon name="arrowRight" size={12} />}
                  <span className={cx(styles.historyScore, h >= THRESHOLDS.deliver ? styles.pass : h >= THRESHOLDS.autofix ? styles.warn : styles.fail)}>{h.toFixed(2)}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Hard gates */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Hard gates</h3>
          <p className={styles.cardHint}>Override the score — can never be averaged away.</p>
          <ul className={styles.gates}>
            {q.hardGates.map((g) => (
              <li key={g.label} className={g.passed ? styles.gatePass : styles.gateFail}>
                <Icon name={g.passed ? 'check' : 'x'} size={14} strokeWidth={3} />
                {g.label}
              </li>
            ))}
          </ul>
        </section>

        {/* Breakdown */}
        <section className={cx(styles.card, styles.wide)}>
          <h3 className={styles.cardTitle}>Score breakdown</h3>
          <p className={styles.cardHint}>Proposed weights — calibrated against designer judgement in the pilot.</p>
          <ul className={styles.bars}>
            {q.dimensions.map((d) => (
              <li key={d.key} className={styles.barRow}>
                <span className={styles.barLabel}>
                  {d.label}
                  <span className={styles.weight}>{Math.round(d.weight * 100)}%</span>
                </span>
                <span className={styles.barTrack}>
                  <span className={cx(styles.barFill, d.score >= THRESHOLDS.deliver ? styles.pass : d.score >= THRESHOLDS.autofix ? styles.warn : styles.fail)} style={{ width: `${d.score * 100}%` }} />
                  <span className={styles.threshold} style={{ left: `${THRESHOLDS.deliver * 100}%` }} aria-hidden />
                </span>
                <span className={styles.barValue}>{d.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Gap report */}
        <section className={cx(styles.card, styles.wide)}>
          <div className={styles.cardHeadRow}>
            <h3 className={styles.cardTitle}>Gap report</h3>
            <Badge size="sm" tone={q.gaps.length ? 'warning' : 'success'}>
              {q.gaps.length} open
            </Badge>
          </div>
          {q.gaps.length === 0 ? (
            <p className={styles.noGaps}>
              <Icon name="shieldCheck" size={18} /> No open gaps — every value resolves to an AAVA token.
            </p>
          ) : (
            <div className={styles.gaps}>
              {q.gaps.map((g, i) => (
                <GapRow key={i} gap={g} />
              ))}
            </div>
          )}
        </section>

        {/* Bands */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Threshold bands</h3>
          <ul className={styles.bands}>
            {BANDS.map((b) => (
              <li key={b.tone} className={cx(styles.band, styles[`band_${b.tone}`], band === b.tone && styles.bandActive)}>
                <strong>{b.range}</strong>
                <span>{b.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Precedence */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>When verifiers disagree</h3>
          <ol className={styles.precedence}>
            {PRECEDENCE.map((p, i) => (
              <li key={p}>
                <span className={styles.rank}>{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

function GapRow({ gap: g }: { gap: Gap }) {
  return (
    <article className={cx(styles.gap, g.severity === 'hard' && styles.gapHard)}>
      <header className={styles.gapHead}>
        <code className={styles.gapEl}>{g.el}</code>
        <span className={styles.gapProp}>{g.prop}</span>
        <Badge size="sm" tone={SOURCE_TONE[g.source]}>
          {SOURCE_LABEL[g.source]}
        </Badge>
        {g.severity === 'hard' && (
          <Badge size="sm" tone="danger">
            hard gate
          </Badge>
        )}
      </header>
      <div className={styles.gapBody}>
        <span className={styles.found}>{g.found}</span>
        <Icon name="arrowRight" size={14} />
        <span className={styles.expected}>{g.expected}</span>
      </div>
      <footer className={styles.gapFoot}>
        <span>{g.rule}</span>
        <span>fix: {g.fix}</span>
      </footer>
    </article>
  )
}
