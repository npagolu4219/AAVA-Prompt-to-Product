import { lazy, Suspense, useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { ScreenStrip } from '@/features/screens/ScreenStrip'
import { EventsPane } from './events/EventsPane'
import { FlowPane } from './flow/FlowPane'
import { PreviewPane } from './preview/PreviewPane'
import { QualityPane } from './quality/QualityPane'
import { SpecPane } from './spec/SpecPane'
import styles from './CanvasPanel.module.scss'

// Monaco is heavy — load the Code tab on first use.
const CodePane = lazy(() => import('./code/CodePane').then((m) => ({ default: m.CodePane })))

type CanvasTab = 'preview' | 'flow' | 'spec' | 'code' | 'quality' | 'events'

interface Props {
  onExport: () => void
  onPublish: () => void
}

/** Right pane: screen switcher + six views over the active screen / project. */
export function CanvasPanel({ onExport, onPublish }: Props) {
  const { state, activeScreen } = useRun()
  // A new full run snaps the canvas to Preview so the build theatre is visible; manual picks stick per run.
  const [sel, setSel] = useState<{ tab: CanvasTab; run: string | null }>({ tab: 'preview', run: null })
  const building = (state.status === 'running' || state.status === 'waiting') && state.mode === 'full'
  const tab: CanvasTab = building && sel.run !== state.runId ? 'preview' : sel.tab
  const setTab = (t: CanvasTab) => setSel({ tab: t, run: state.runId })
  const shared = activeScreen?.shared
  const q = shared?.quality
  const built = state.screens.filter((s) => s.surface).length
  const codeFiles = state.screens.reduce((n, s) => n + (s.surface ? s.shared.files.length : 0), 0)

  const items: TabItem<CanvasTab>[] = [
    { id: 'preview', label: 'Preview', icon: 'eye' },
    { id: 'flow', label: 'Flow', icon: 'flow', badge: built ? <Badge size="sm" tone="primary">{built}</Badge> : undefined },
    { id: 'spec', label: 'Spec', icon: 'fileText' },
    { id: 'code', label: 'Code', icon: 'code', badge: codeFiles ? <Badge size="sm">{codeFiles}</Badge> : undefined },
    {
      id: 'quality',
      label: 'Quality',
      icon: 'shieldCheck',
      badge: q ? (
        <Badge size="sm" tone={q.decision === 'deliver' ? 'success' : q.decision === 'autofix' ? 'warning' : 'danger'}>
          {q.score.toFixed(2)}
        </Badge>
      ) : undefined,
    },
    { id: 'events', label: 'Events', icon: 'activity', badge: state.events.length ? <Badge size="sm">{state.events.length}</Badge> : undefined },
  ]

  return (
    <section className={styles.canvas} aria-label="Canvas">
      <ScreenStrip />
      <Tabs
        items={items}
        value={tab}
        onChange={setTab}
        label="Canvas views"
        idPrefix="canvas"
        actions={
          <>
            <Button size="sm" icon="download" onClick={onExport} disabled={!built} title="Export ZIP for a tech stack">
              <span className={styles.actionLabel}>Export</span>
            </Button>
            <Button size="sm" variant="primary" icon="cloud" onClick={onPublish} disabled={!built} title="Publish to cloud">
              <span className={styles.actionLabel}>Publish</span>
            </Button>
          </>
        }
      />
      <div className={styles.panel} role="tabpanel" id={`canvas-panel-${tab}`} aria-labelledby={`canvas-tab-${tab}`}>
        {tab === 'preview' && <PreviewPane />}
        {tab === 'flow' && <FlowPane onOpen={() => setTab('preview')} />}
        {tab === 'spec' && <SpecPane />}
        {tab === 'code' && (
          <Suspense fallback={<div className={styles.loading}>Loading code editor…</div>}>
            <CodePane />
          </Suspense>
        )}
        {tab === 'quality' && <QualityPane />}
        {tab === 'events' && <EventsPane />}
      </div>
    </section>
  )
}
