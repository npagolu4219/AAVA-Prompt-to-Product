import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon, type IconName } from '@/components/ui/Icon'
import { STEP_NAMES, STORAGE_KEYS } from '@/config/app'
import { CanvasPanel } from '@/features/canvas/CanvasPanel'
import { ChatThread } from '@/features/chat/ChatThread'
import { PromptComposer } from '@/features/chat/PromptComposer'
import { DataSourcesDrawer } from '@/features/data/DataSourcesDrawer'
import { ExportDialog } from '@/features/export/ExportDialog'
import { AppHeader } from '@/features/header/AppHeader'
import { HistoryPage } from '@/features/history/HistoryPage'
import { HitlCard } from '@/features/hitl/HitlCard'
import { LandingPage } from '@/features/landing/LandingPage'
import { AppNav } from '@/features/nav/AppNav'
import { NavMenuContext, useHashRoute, type Route } from '@/features/nav/routing'
import { PublishDialog } from '@/features/publish/PublishDialog'
import { ResourcesPage } from '@/features/resources/ResourcesPage'
import { RoiPage } from '@/features/roi/RoiPage'
import { SettingsDrawer } from '@/features/settings/SettingsDrawer'
import { StepMap } from '@/features/steps/StepMap'
import { useIsMobile, useLocalStorage, useMediaQuery } from '@/hooks'
import type { FigmaRef } from '@/types/run'
import { cx } from '@/utils/format'
import { useRun } from './providers/RunProvider'
import { useToast } from './providers/ToastProvider'
import styles from './Workspace.module.scss'

type MobileView = 'chat' | 'steps' | 'canvas'

const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }

/** Run a DOM update inside a view transition when supported (cross-fade / morph), else directly. */
function withTransition(update: () => void, done?: () => void) {
  const doc = document as DocWithVT
  if (doc.startViewTransition && !reducedMotion()) {
    const t = doc.startViewTransition(() => flushSync(update))
    void t.finished.finally(() => done?.())
  } else {
    update()
    if (done) setTimeout(done, 900)
  }
}

/**
 * App shell: left navigation (rail on desktop/tablet, drawer on phones) + routed pages:
 * Home (landing) · Studio (chat + canvas) · Context (resources) · History (saved chats).
 */
export function Workspace() {
  const { state, start, openThread, resetWorkspace } = useRun()
  const notify = useToast()
  const isTablet = useMediaQuery('(max-width: 1279.98px)')
  const [route, navigate] = useHashRoute()
  const [navPref, setNavPref] = useLocalStorage<{ expanded: boolean | null }>('aava-p2p.nav.v1', { expanded: null })
  const navExpanded = navPref.expanded ?? !isTablet
  const [mobileNav, setMobileNav] = useState(false)
  const [view, setView] = useState<MobileView>('chat')
  const [entering, setEntering] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)

  const go = (r: Route) => withTransition(() => navigate(r))

  /** Landing prompt → new conversation in the studio (prompt bar morphs into the composer). */
  const enterStudio = (prompt: string, figma?: FigmaRef) =>
    withTransition(
      () => {
        start(prompt, figma, 'new', { fresh: true })
        navigate('studio')
        setEntering(true)
        setView('canvas') // phones land on the live preview
      },
      () => setEntering(false),
    )

  const newChat = () =>
    withTransition(() => {
      resetWorkspace()
      navigate('home')
    })

  const open = async (id: string) => {
    if (id !== state.threadId) {
      const ok = await openThread(id)
      if (!ok) return notify('That conversation could not be loaded', 'danger')
    }
    withTransition(() => {
      navigate('studio')
      setView('chat')
    })
  }

  const rerun = (prompt: string) => enterStudio(prompt)

  let page: React.ReactNode
  switch (route) {
    case 'home':
      page = <LandingPage onSubmit={enterStudio} onOpenData={() => setDataOpen(true)} />
      break
    case 'resources':
      page = <ResourcesPage />
      break
    case 'roi':
      page = <RoiPage />
      break
    case 'history':
      page = <HistoryPage onOpen={open} onNewChat={newChat} onRerun={rerun} />
      break
    default:
      page = <Studio view={view} setView={setView} entering={entering} onOpenData={() => setDataOpen(true)} onGoContext={() => go('resources')} />
  }

  return (
    <NavMenuContext.Provider value={() => setMobileNav(true)}>
      <div className={styles.shell}>
        <AppNav
          route={route}
          expanded={navExpanded}
          onToggleExpanded={() => setNavPref({ expanded: !navExpanded })}
          mobileOpen={mobileNav}
          onCloseMobile={() => setMobileNav(false)}
          onNavigate={go}
          onNewChat={newChat}
          onOpenThread={(id) => void open(id)}
          onOpenData={() => setDataOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className={styles.pageSlot}>{page}</div>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DataSourcesDrawer open={dataOpen} onClose={() => setDataOpen(false)} />
    </NavMenuContext.Provider>
  )
}

interface StudioProps {
  view: MobileView
  setView: (v: MobileView) => void
  entering: boolean
  onOpenData: () => void
  onGoContext: () => void
}

/**
 * Two-pane studio (slide 10).
 *  Desktop/tablet: left = step map + chat + HITL + composer, right = canvas.
 *  Phone: one view at a time with a bottom tab bar; HITL becomes a bottom sheet.
 */
function Studio({ view, setView, entering, onOpenData, onGoContext }: StudioProps) {
  const { state } = useRun()
  const isMobile = useIsMobile()
  const [exportOpen, setExportOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [prefs, setPrefs] = useLocalStorage(STORAGE_KEYS.leftPaneStepsOpen, { stepsOpen: true })
  // Canvas tab shows a dot when the preview changed since the user last looked at it (phones).
  const revision = state.screens.reduce((n, s) => n + (s.surface?.revision ?? 0), 0)
  const [seenRevision, setSeenRevision] = useState(0)
  const canvasUnseen = view !== 'canvas' && revision > seenRevision

  const switchView = (v: MobileView) => {
    if (v === 'canvas' || view === 'canvas') setSeenRevision(revision)
    setView(v)
  }

  const runningStep = state.steps.find((s) => s.status === 'running' || s.status === 'waiting')
  const doneCount = state.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length

  const nav: { id: MobileView; label: string; icon: IconName; dot?: boolean; meta?: string }[] = [
    { id: 'chat', label: 'Chat', icon: 'message', dot: Boolean(state.interrupt) },
    { id: 'steps', label: 'Steps', icon: 'list', meta: state.status === 'idle' ? undefined : `${doneCount}/${STEP_NAMES.length}` },
    { id: 'canvas', label: 'Canvas', icon: 'layout', dot: canvasUnseen },
  ]

  return (
    <div className={cx(styles.app, entering && styles.entering)}>
      <AppHeader onOpenData={onOpenData} />

      <main className={styles.main} data-view={view}>
        <aside className={styles.left} aria-label="Conversation and steps">
          <section className={cx(styles.steps, !prefs.stepsOpen && styles.stepsCollapsed)}>
            <button type="button" className={styles.sectionHead} onClick={() => setPrefs({ stepsOpen: !prefs.stepsOpen })} aria-expanded={prefs.stepsOpen}>
              <span className={styles.sectionTitle}>
                <Icon name="list" size={14} /> Step map
              </span>
              {runningStep ? (
                <span className={styles.live}>
                  <span className={styles.liveDot} /> {runningStep.name}
                </span>
              ) : (
                <span className={styles.sectionMeta}>{state.status === 'idle' ? 'Sense → Deliver' : `${doneCount}/${STEP_NAMES.length} complete`}</span>
              )}
              <Icon name={prefs.stepsOpen ? 'chevronUp' : 'chevronDown'} size={14} className={styles.chev} />
            </button>
            <div className={styles.stepsBody}>
              <StepMap variant={isMobile ? 'full' : 'compact'} />
            </div>
          </section>

          <section className={styles.chat}>
            <div className={styles.sectionHeadStatic}>
              <span className={styles.sectionTitle}>
                <Icon name="message" size={14} /> Chat
              </span>
              <span className={styles.sectionMeta}>{state.runCount ? `${state.runCount} run${state.runCount > 1 ? 's' : ''} · ${state.screens.length} screen${state.screens.length === 1 ? '' : 's'}` : 'AG-UI stream'}</span>
            </div>
            <div className={styles.thread}>
              <ChatThread />
            </div>
            <div className={styles.bottom}>
              {!isMobile && state.interrupt && <HitlCard key={state.interrupt.id} interrupt={state.interrupt} />}
              <PromptComposer onGoContext={onGoContext} />
            </div>
          </section>
        </aside>

        <div className={styles.right}>
          <CanvasPanel onExport={() => setExportOpen(true)} onPublish={() => setPublishOpen(true)} />
        </div>
      </main>

      {isMobile && state.interrupt && (
        <div className={styles.sheet}>
          <HitlCard key={state.interrupt.id} interrupt={state.interrupt} variant="sheet" />
        </div>
      )}

      <nav className={styles.mobileNav} aria-label="Workspace views">
        {nav.map((n) => (
          <button key={n.id} type="button" className={cx(styles.navItem, view === n.id && styles.navActive)} onClick={() => switchView(n.id)} aria-current={view === n.id ? 'page' : undefined}>
            <span className={styles.navIcon}>
              <Icon name={n.icon} size={20} />
              {n.dot && <span className={styles.navDot} aria-label="Has updates" />}
            </span>
            <span className={styles.navLabel}>
              {n.label}
              {n.meta && <span className={styles.navMeta}> {n.meta}</span>}
            </span>
          </button>
        ))}
      </nav>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  )
}
