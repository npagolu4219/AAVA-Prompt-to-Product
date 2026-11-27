import { useRun } from '@/app/providers/RunProvider'
import { Icon } from '@/components/ui/Icon'
import { MAX_SCREENS, THRESHOLDS } from '@/config/app'
import { cx } from '@/utils/format'
import styles from './ScreenStrip.module.scss'

/** Asks the composer to prepare a "new screen" prompt (decoupled via a DOM event). */
export const requestNewScreen = () => window.dispatchEvent(new CustomEvent('aava:compose', { detail: { mode: 'new' } }))

/** Horizontal switcher for the project's screens (max 10) — the multi-screen spine of the canvas. */
export function ScreenStrip() {
  const { state, selectScreen, isBusy, canAddScreen } = useRun()
  const screens = state.screens
  if (screens.length === 0) return null

  return (
    <nav className={styles.strip} aria-label="Screens in this project">
      <span className={styles.count}>
        <Icon name="layout" size={13} />
        {screens.length}/{MAX_SCREENS}
      </span>
      <ol className={styles.list}>
        {screens.map((s, i) => {
          const building = isBusy && state.runScreenId === s.id
          const q = s.shared.quality
          const tone = !q ? '' : q.score >= THRESHOLDS.deliver ? styles.good : q.score >= THRESHOLDS.autofix ? styles.warn : styles.bad
          return (
            <li key={s.id}>
              <button
                type="button"
                className={cx(styles.chip, s.id === state.activeScreenId && styles.on)}
                onClick={() => selectScreen(s.id)}
                aria-current={s.id === state.activeScreenId ? 'page' : undefined}
                title={`${s.shared.title || 'Generating…'} · ${s.route}`}
              >
                <span className={styles.idx}>{i + 1}</span>
                <span className={styles.name}>{s.shared.title || 'Generating…'}</span>
                {building ? <span className={styles.spinner} aria-label="Building" /> : q && <span className={cx(styles.score, tone)}>{q.score.toFixed(2)}</span>}
                {s.signedOff && <Icon name="check" size={12} strokeWidth={3} className={styles.signed} aria-label="Signed off" />}
              </button>
              {i < screens.length - 1 && <Icon name="chevronRight" size={12} className={styles.sep} aria-hidden />}
            </li>
          )
        })}
      </ol>
      <button type="button" className={styles.add} onClick={requestNewScreen} disabled={isBusy || !canAddScreen} title={canAddScreen ? 'Add a screen' : `Limit of ${MAX_SCREENS} screens reached`}>
        <Icon name="plus" size={14} />
        <span>Screen</span>
      </button>
    </nav>
  )
}
