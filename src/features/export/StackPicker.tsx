import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { STACKS } from '@/services/export/stacks'
import type { StackId } from '@/types/export'
import { cx } from '@/utils/format'
import styles from './export.module.scss'

const LOGO: Record<StackId, { mark: string; tone: string }> = {
  angular: { mark: 'A', tone: '#dd0031' },
  react: { mark: '⚛', tone: '#149eca' },
  vue: { mark: 'V', tone: '#42b883' },
  html: { mark: '</>', tone: '#e34c26' },
}

interface Props {
  value: StackId | null
  onChange: (id: StackId) => void
}

/** Required choice before any download/publish — the template depends on it. */
export function StackPicker({ value, onChange }: Props) {
  return (
    <div className={styles.stackGrid} role="radiogroup" aria-label="Tech stack">
      {STACKS.map((s) => {
        const on = value === s.id
        return (
          <button key={s.id} type="button" role="radio" aria-checked={on} className={cx(styles.stackCard, on && styles.stackOn)} onClick={() => onChange(s.id)}>
            <span className={styles.stackHead}>
              {/* Brand marks are the only non-token colours: they identify third-party frameworks. */}
              <span className={styles.stackLogo} style={{ ['--logo' as string]: LOGO[s.id].tone }} aria-hidden>
                {LOGO[s.id].mark}
              </span>
              <span className={styles.stackTitles}>
                <strong>{s.name}</strong>
                <span>{s.tagline}</span>
              </span>
              {s.recommended && (
                <Badge size="sm" tone="primary">
                  Reference
                </Badge>
              )}
              <span className={styles.radio} aria-hidden>
                {on && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
            </span>
            <ul className={styles.stackFeatures}>
              {s.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={12} strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            {s.note && <span className={styles.stackNote}>{s.note}</span>}
          </button>
        )
      })}
    </div>
  )
}
