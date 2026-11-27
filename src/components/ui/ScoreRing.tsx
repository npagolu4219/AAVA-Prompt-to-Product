import { THRESHOLDS } from '@/config/app'
import { cx } from '@/utils/format'
import styles from './ScoreRing.module.scss'

interface Props {
  score: number | null
  size?: number
  label?: string
}

export function ScoreRing({ score, size = 120, label = 'Quality score' }: Props) {
  const stroke = Math.max(6, size / 12)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const value = score ?? 0
  const tone = score == null ? 'idle' : value >= THRESHOLDS.deliver ? 'pass' : value >= THRESHOLDS.autofix ? 'warn' : 'fail'

  return (
    <div className={cx(styles.ring, styles[tone])} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score == null ? 'pending' : value.toFixed(2)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={styles.value}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.center}>
        <strong style={{ fontSize: size / 4.4 }}>{score == null ? '—' : value.toFixed(2)}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}
