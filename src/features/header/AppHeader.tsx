import { useDataSources } from '@/app/providers/DataSourceProvider'
import { useResources } from '@/app/providers/ResourcesProvider'
import { useRun } from '@/app/providers/RunProvider'
import { useOpenNav } from '@/features/nav/routing'
import { useTheme } from '@/app/providers/ThemeProvider'
import { IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MAX_SCREENS, THRESHOLDS } from '@/config/app'
import type { RunStatus } from '@/types/run'
import { cx, formatScore } from '@/utils/format'
import styles from './AppHeader.module.scss'

const STATUS_COPY: Record<RunStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  waiting: 'Needs you',
  finished: 'Done',
  error: 'Error',
  cancelled: 'Stopped',
}

interface Props {
  onOpenData: () => void
}

export function AppHeader({ onOpenData }: Props) {
  const { state, activeScreen, agentKind } = useRun()
  const { enabled } = useResources()
  const openNav = useOpenNav()
  const { active: dataSource } = useDataSources()
  const { resolvedMode, update } = useTheme()
  const q = activeScreen?.shared.quality
  const built = state.screens.filter((s) => s.surface).length
  const scoreTone = !q ? 'neutral' : q.score >= THRESHOLDS.deliver ? 'good' : q.score >= THRESHOLDS.autofix ? 'warn' : 'bad'

  return (
    <header className={styles.header}>
      <IconButton icon="menu" label="Open navigation" className={cx(styles.iconBtn, styles.menuBtn)} onClick={openNav} />
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <svg viewBox="0 0 32 32" width="30" height="30">
            <rect width="32" height="32" rx="8" fill="currentColor" opacity=".14" />
            <path d="M9 23 16 8l7 15" fill="none" stroke="var(--c-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.5 18h9" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
        <div className={styles.titles}>
          <span className={styles.name}>
            AAVA <strong>Prompt-to-Product</strong>
          </span>
          <span className={styles.sub}>
            {activeScreen?.shared.title ? `${built}/${MAX_SCREENS} screens · ${activeScreen.shared.title} v${activeScreen.shared.version}` : 'Agentic UI generation · AG-UI + A2UI'}
          </span>
        </div>
      </div>

      <div className={styles.chips} aria-label="Run summary">
        <span className={cx(styles.chip, styles.status, styles[state.status])}>
          <span className={styles.pulse} aria-hidden />
          {STATUS_COPY[state.status]}
        </span>
        {activeScreen && (
          <span className={cx(styles.chip, styles.hideMd)} title="Source of the active screen">
            <Icon name={activeScreen.source.kind === 'figma' ? 'figma' : 'message'} size={13} />
            {activeScreen.source.kind === 'figma' ? activeScreen.source.label : 'Prompt'}
            {activeScreen.signedOff && <span className={styles.check}>✓</span>}
          </span>
        )}
        <button type="button" className={cx(styles.chip, styles.chipBtn, styles.hideSm, dataSource ? styles.good : styles.warn)} onClick={onOpenData} title="Data sources">
          <Icon name="database" size={13} />
          {dataSource ? dataSource.name : 'No database'}
        </button>
        <span className={cx(styles.chip, styles.score, styles[scoreTone])} title="Weighted quality score">
          <Icon name="gauge" size={13} />
          <span className={styles.hideXs}>Score</span> {formatScore(q?.score)}
        </span>
        <span className={cx(styles.chip, styles.hideSm, q && (q.lintErrors ? styles.bad : styles.good))} title="AAVA Design Linter">
          <Icon name="shieldCheck" size={13} />
          Lint {q ? `${q.lintErrors} err` : '—'}
        </span>
        <a className={cx(styles.chip, styles.chipBtn, styles.hideLg)} href="#/resources" title="Context resources grounding this chat">
          <Icon name="layers" size={13} />
          {enabled.length} context
        </a>
        <span className={cx(styles.chip, styles.agent, styles.hideXl)} title={agentKind === 'mock' ? 'Mock agent with dummy data. Set VITE_AGENT_URL to stream from a real AG-UI endpoint.' : 'Live AG-UI endpoint'}>
          <Icon name="bolt" size={13} />
          {agentKind === 'mock' ? 'Mock agent' : 'AG-UI live'}
        </span>
      </div>

      <nav className={styles.actions} aria-label="Workspace">
        <IconButton
          icon={resolvedMode === 'dark' ? 'sun' : 'moon'}
          label={resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className={styles.iconBtn}
          onClick={() => update({ mode: resolvedMode === 'dark' ? 'light' : 'dark' })}
        />
        <IconButton icon="database" label="Data sources" className={cx(styles.iconBtn, styles.hideXs)} onClick={onOpenData} />
      </nav>
    </header>
  )
}
