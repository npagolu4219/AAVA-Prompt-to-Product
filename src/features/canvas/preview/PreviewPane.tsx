import { useMemo, useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PROMPT_SUGGESTIONS } from '@/config/app'
import { cx } from '@/utils/format'
import { A2uiSurface } from './A2uiSurface'
import { LiveCode } from './LiveCode'
import { PlanningStage } from './PlanningStage'
import { PHASE_COPY, useBuildPhase } from './useBuildPhase'
import styles from './Preview.module.scss'

type Device = 'desktop' | 'tablet' | 'mobile'

const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 768, mobile: 390 }

const VERIFIERS: { tool: string; label: string }[] = [
  { tool: 'critic.review', label: 'Critic' },
  { tool: 'axe.scan', label: 'a11y' },
  { tool: 'designLinter.run', label: 'Lint' },
  { tool: 'playwright.verify', label: 'Playwright' },
]

const pretty = (o: unknown) => JSON.stringify(o).replace(/":/g, '": ').replace(/,"/g, ', "')

export function PreviewPane() {
  const { activeScreen, setData, resetData, sendSurfaceAction, start, isBusy } = useRun()
  const build = useBuildPhase()
  const [device, setDevice] = useState<Device>('desktop')
  const [showData, setShowData] = useState(false)
  // Live code opens automatically while building; the user can override per run.
  const [codePref, setCodePref] = useState<{ run: string | null; open: boolean } | null>(null)
  const surface = activeScreen?.surface ?? null
  const files = activeScreen?.shared.files

  const codeOpen = codePref && codePref.run === build.runId ? codePref.open : build.building && build.phase !== 'planning'
  const animate = build.building && build.mode === 'full'

  const codeText = useMemo(() => {
    const comps = Object.values(surface?.components ?? {})
    const lines = ['// A2UI v0.9 → surface "canvas" (streamed over AG-UI CUSTOM events)', '{ "updateComponents": { "components": [', ...comps.map((c) => `    ${pretty(c)},`), '] } }']
    const ts = files?.find((f) => f.path.endsWith('.component.ts'))
    const html = files?.find((f) => f.path.endsWith('.component.html'))
    if (ts) lines.push('', `// codegen.angular → ${ts.path}`, ...ts.content.split('\n').slice(0, 48))
    if (html) lines.push('', `// ${html.path}`, ...html.content.split('\n').slice(0, 40))
    return lines.join('\n')
  }, [surface?.components, files])

  if (!surface) {
    if (build.building) return <PlanningStage />
    return (
      <EmptyState icon="layout" title="Your screen will appear here" description="Describe a screen or attach a Figma frame. Agents describe the UI as A2UI JSON; only trusted AAVA Play components render it.">
        {!isBusy &&
          PROMPT_SUGGESTIONS.map((p) => (
            <Button key={p} size="sm" icon="sparkles" onClick={() => start(p)}>
              {p.split(',')[0]}
            </Button>
          ))}
      </EmptyState>
    )
  }

  const count = Object.keys(surface.components).length
  const blocked = Object.values(surface.components).filter((c) => !['Column', 'Row', 'Grid'].includes(c.component) && !c.component.startsWith('Aava')).length
  const width = DEVICE_WIDTH[device]

  return (
    <div className={styles.pane}>
      {build.building && build.phase && (
        <div className={styles.buildBar} role="status" aria-live="polite">
          <span className={styles.buildLabel}>
            <span className={styles.buildDot} />
            <strong>{build.waiting ? 'Waiting for you' : `Building ${activeScreen?.shared.title ?? ''}`}</strong>
            <span className={styles.buildPhase}>{build.waiting ? build.interrupt?.title : PHASE_COPY[build.phase]}</span>
          </span>
          <span className={styles.buildPct}>{Math.round(build.progress * 100)}%</span>
          <span className={styles.buildTrack} aria-hidden>
            <span style={{ width: `${build.progress * 100}%` }} />
          </span>
        </div>
      )}

      <div className={styles.toolbar}>
        <SegmentedControl
          label="Preview device"
          size="sm"
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: 'Desktop', icon: 'monitor', hideLabel: true },
            { value: 'tablet', label: 'Tablet', icon: 'tablet', hideLabel: true },
            { value: 'mobile', label: 'Mobile', icon: 'phone', hideLabel: true },
          ]}
        />
        <div className={styles.meta}>
          <Badge tone="primary" size="sm" icon="layout">
            {count} nodes
          </Badge>
          <Badge size="sm">rev {surface.revision}</Badge>
          {blocked > 0 && (
            <Badge tone="danger" size="sm" icon="shield">
              {blocked} blocked
            </Badge>
          )}
          <span className={styles.catalog}>catalog · {surface.catalogId}</span>
        </div>
        <div className={styles.tools}>
          <Button size="sm" variant={codeOpen ? 'primary' : 'secondary'} icon="code" onClick={() => setCodePref({ run: build.runId, open: !codeOpen })} aria-pressed={codeOpen}>
            <span className={styles.hideXs}>Live code</span>
          </Button>
          <Button size="sm" variant="ghost" icon="refresh" onClick={resetData} title="Reset data model to the agent's values">
            <span className={styles.hideSm}>Reset</span>
          </Button>
          <Button size="sm" variant={showData ? 'primary' : 'secondary'} icon="database" onClick={() => setShowData((v) => !v)} aria-pressed={showData}>
            <span className={styles.hideSm}>Data</span>
          </Button>
        </div>
      </div>

      <div className={cx(styles.stage, (codeOpen || showData) && styles.withData)}>
        <div className={styles.viewport}>
          <div className={cx(styles.frame, styles[device], build.building && styles.frameBuilding, build.phase === 'verifying' && styles.frameVerifying)} style={width ? { width, maxWidth: '100%' } : undefined}>
            {device !== 'desktop' && <div className={styles.notch} aria-hidden />}
            {build.phase === 'verifying' && (
              <>
                <div className={styles.scan} aria-hidden />
                <ul className={styles.verifiers} aria-label="Verifiers">
                  {VERIFIERS.map((v) => {
                    const call = build.verifyCalls.find((t) => t.name === v.tool)
                    const st = call?.status === 'done' ? 'done' : call ? 'running' : 'pending'
                    return (
                      <li key={v.tool} className={styles[`v_${st}`]}>
                        {st === 'done' ? <Icon name="check" size={11} strokeWidth={3} /> : <span className={styles.vSpin} />}
                        {v.label}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            <div className={cx(styles.frameInner, animate && styles.assembling)}>
              <A2uiSurface surface={surface} onData={setData} onAction={sendSurfaceAction} />
            </div>
          </div>
        </div>
        {codeOpen ? (
          <LiveCode
            className={styles.codePanel}
            text={codeText}
            typing={build.building}
            title={files?.length ? `${activeScreen?.slug}.component.ts` : 'a2ui.messages.json'}
            caption={build.building ? (build.phase === 'composing' ? 'streaming…' : 'compiling…') : `${files?.length ?? 0} files`}
          />
        ) : (
          showData && (
            <aside className={styles.data} aria-label="A2UI data model">
              <div className={styles.dataHead}>
                <span>Data model</span>
                <span className={styles.dataHint}>two-way bound · edits stay local</span>
              </div>
              <pre>{JSON.stringify(surface.dataModel, null, 2)}</pre>
            </aside>
          )
        )}
      </div>
    </div>
  )
}
