import { useMemo, useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { analyzeFiles } from '@/services/analysis/analyzeCode'
import { buildProject, stackMeta } from '@/services/export/stacks'
import { downloadZip } from '@/services/export/zipExport'
import { PROVIDERS } from '@/services/publish/publish'
import type { CloudProvider, ExportOptions, StackId } from '@/types/export'
import { useDeploySettings } from '../publish/useDeploySettings'
import type { ScreenState } from '@/types/project'
import { cx } from '@/utils/format'
import { AnalysisReport } from './AnalysisReport'
import { StackPicker } from './StackPicker'
import styles from './export.module.scss'

const STEPS = ['Tech stack', 'Configure', 'Analyse & download']

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

interface Props {
  open: boolean
  onClose: () => void
}

/** Download flow: choose a stack first, configure the template, review the analysis, then ZIP. */
export function ExportDialog({ open, onClose }: Props) {
  const { state } = useRun()
  const screens = state.screens.filter((s) => s.surface)
  return (
    <Modal open={open} onClose={onClose} title="Export project" subtitle="Generated code in a runnable template for the stack you choose." icon="package" flush>
      {screens.length === 0 ? <EmptyState icon="package" title="Nothing to export yet" description="Generate at least one screen first." /> : <ExportWizard key={String(open)} screens={screens} onDone={onClose} />}
    </Modal>
  )
}

function ExportWizard({ screens, onDone }: { screens: ScreenState[]; onDone: () => void }) {
  const { settings } = useTheme()
  const notify = useToast()
  const [step, setStep] = useState(0)
  const [stack, setStack] = useState<StackId | null>(null)
  const [opts, setOpts] = useState<Omit<ExportOptions, 'stack'>>({
    projectName: 'aava-prompt-to-product-app',
    screenIds: screens.map((s) => s.id),
    includeTests: true,
    includeData: true,
    includeDocker: false,
    includeCi: false,
    aavaSource: 'portable',
    apiUrl: '',
    deploy: null,
  })
  const deploySettings = useDeploySettings()
  const [deployTarget, setDeployTarget] = useState<CloudProvider | 'none'>('none')
  const fullOpts = useMemo(
    () => ({ ...opts, apiUrl: deploySettings.apiUrl, deploy: deployTarget === 'none' ? null : deploySettings.config(deployTarget) }),
    [opts, deploySettings, deployTarget],
  )
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const project = useMemo(() => (step === 2 && stack ? buildProject({ ...fullOpts, stack }, screens, settings) : null), [step, stack, fullOpts, screens, settings])
  const analysis = useMemo(
    () => (project ? analyzeFiles(project.files, { screens: screens.filter((s) => opts.screenIds.includes(s.id)), routes: project.routes }) : null),
    [project, screens, opts.screenIds],
  )
  const previewFile = project?.files.find((f) => f.path === preview) ?? project?.files.find((f) => /screens\//.test(f.path)) ?? project?.files[0]

  const canNext = step === 0 ? Boolean(stack) : step === 1 ? opts.screenIds.length > 0 && opts.projectName.length > 1 : true

  const download = async () => {
    if (!project || !stack) return
    setBusy(true)
    try {
      // Everything inside one top-level folder, so unzip → cd → npm install just works.
      await downloadZip(project.files.map((f) => ({ ...f, path: `${opts.projectName}/${f.path}` })), [], `${opts.projectName}-${stack}`)
      notify(`Downloaded ${opts.projectName}-${stack}.zip`, 'success')
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wizard}>
      <ol className={styles.wizardSteps} aria-label="Export steps">
        {STEPS.map((s, i) => (
          <li key={s} className={cx(i === step && styles.wsOn, i < step && styles.wsDone)} aria-current={i === step ? 'step' : undefined}>
            <span>{i < step ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className={styles.wizardBody}>
        {step === 0 && (
          <>
            <p className={styles.lead}>Which tech stack should the ZIP use? The template, routing and data layer are generated for it.</p>
            <StackPicker value={stack} onChange={setStack} />
          </>
        )}

        {step === 1 && stack && (
          <div className={styles.configure}>
            <label className={styles.field}>
              <span>Project name</span>
              <input className={styles.input} value={opts.projectName} onChange={(e) => setOpts((o) => ({ ...o, projectName: slugify(e.target.value) }))} spellCheck={false} />
            </label>

            <fieldset className={styles.fieldset}>
              <legend>
                Screens <Badge size="sm">{opts.screenIds.length}/{screens.length}</Badge>
              </legend>
              <ul className={styles.screenChecks}>
                {screens.map((s, i) => {
                  const on = opts.screenIds.includes(s.id)
                  const q = s.shared.quality
                  return (
                    <li key={s.id}>
                      <label className={cx(styles.screenCheck, on && styles.screenCheckOn)}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setOpts((o) => ({ ...o, screenIds: on ? o.screenIds.filter((x) => x !== s.id) : [...o.screenIds, s.id] }))}
                        />
                        <span className={styles.screenIdx}>{i + 1}</span>
                        <span className={styles.screenName}>
                          {s.shared.title}
                          <code>{s.route}</code>
                        </span>
                        {q && <Badge size="sm" tone={q.score >= 0.9 ? 'success' : q.score >= 0.75 ? 'warning' : 'danger'}>{q.score.toFixed(2)}</Badge>}
                        {s.signedOff ? <Badge size="sm" tone="success" icon="check">signed off</Badge> : <Badge size="sm">draft</Badge>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Template options · {stackMeta(stack).name}</legend>
              <div className={styles.switches}>
                <Switch label="Live data from database" description={stack === 'html' ? 'Seeds only for static HTML (rendered at export).' : 'API client that fetches DB collections, seeded with imported rows.'} checked={opts.includeData} onChange={(v) => setOpts((o) => ({ ...o, includeData: v }))} />
                <Switch label="Playwright + axe tests" description="One e2e spec per screen, desktop + mobile projects." checked={opts.includeTests} onChange={(v) => setOpts((o) => ({ ...o, includeTests: v }))} />
                <Switch label="Dockerfile + nginx" description="Multi-stage build, SPA fallback routing." checked={opts.includeDocker} onChange={(v) => setOpts((o) => ({ ...o, includeDocker: v }))} />
                <Switch label="GitHub Actions CI" description="Install, build and run tests on every push." checked={opts.includeCi} onChange={(v) => setOpts((o) => ({ ...o, includeCi: v }))} />
              </div>
            </fieldset>

            {stack === 'angular' && (
              <fieldset className={styles.fieldset}>
                <legend>AAVA Play components</legend>
                <div className={styles.row2}>
                  <label className={cx(styles.screenCheck, opts.aavaSource === 'portable' && styles.screenCheckOn)}>
                    <input type="radio" name="aava-source" checked={opts.aavaSource === 'portable'} onChange={() => setOpts((o) => ({ ...o, aavaSource: 'portable' }))} />
                    <span className={styles.screenName}>
                      Portable kit (recommended)
                      <code>Bundled in src/app/aava-play · installs from public npm</code>
                    </span>
                  </label>
                  <label className={cx(styles.screenCheck, opts.aavaSource === 'registry' && styles.screenCheckOn)}>
                    <input type="radio" name="aava-source" checked={opts.aavaSource === 'registry'} onChange={() => setOpts((o) => ({ ...o, aavaSource: 'registry' }))} />
                    <span className={styles.screenName}>
                      Internal @aava/play package
                      <code>Needs access to your private npm registry (.npmrc)</code>
                    </span>
                  </label>
                </div>
              </fieldset>
            )}

            <fieldset className={styles.fieldset}>
              <legend>Data API & deployment</legend>
              <div className={styles.row2}>
                <label className={styles.field}>
                  <span>Data API URL (optional)</span>
                  <input className={styles.input} placeholder="https://api.example.com — empty = seed data" value={deploySettings.apiUrl} onChange={(e) => deploySettings.setApiUrl(e.target.value.trim())} spellCheck={false} />
                </label>
                <label className={styles.field}>
                  <span>Include deploy config for</span>
                  <select className={cx(styles.input, styles.select)} value={deployTarget} onChange={(e) => setDeployTarget(e.target.value as CloudProvider | 'none')}>
                    <option value="none">None</option>
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.service})
                      </option>
                    ))}
                  </select>
                  <span className={styles.hint}>Uses the settings saved in Publish → Provider & config. Adds DEPLOY.md with CLI steps.</span>
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && project && analysis && stack && (
          <div className={styles.review}>
            <div className={styles.runBox}>
              <Icon name="play" size={14} />
              <div>
                <strong>Run locally</strong>
                <code>
                  unzip {opts.projectName}-{stack}.zip && cd {opts.projectName} && {stackMeta(stack).run}
                </code>
                <span>Node.js 20.19+ · opens on http://localhost:{stackMeta(stack).port}</span>
              </div>
            </div>
            <AnalysisReport analysis={analysis} />
            {project.notes.map((n) => (
              <p key={n} className={styles.note}>
                <Icon name="info" size={14} /> {n}
              </p>
            ))}
            <div className={styles.explorer}>
              <ul className={styles.tree} aria-label="Files in the ZIP">
                {project.files.map((f) => (
                  <li key={f.path}>
                    <button type="button" className={cx(styles.treeItem, previewFile?.path === f.path && styles.treeOn)} onClick={() => setPreview(f.path)}>
                      <Icon name="file" size={13} />
                      <span>{f.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <pre className={styles.code} aria-label={`Preview of ${previewFile?.path}`}>
                <span className={styles.codePath}>{previewFile?.path}</span>
                {previewFile?.content}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className={styles.wizardFoot}>
        {step > 0 && (
          <Button variant="ghost" icon="chevronLeft" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            Back
          </Button>
        )}
        <span className={styles.spacer} />
        {step < 2 ? (
          <Button variant="primary" iconRight="arrowRight" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            {step === 0 ? (stack ? `Use ${stackMeta(stack).name}` : 'Choose a stack') : 'Analyse code'}
          </Button>
        ) : (
          <Button variant={analysis?.counts.error ? 'secondary' : 'primary'} icon="download" loading={busy} onClick={download}>
            {analysis?.counts.error ? 'Download anyway' : 'Download ZIP'}
          </Button>
        )}
      </div>
    </div>
  )
}
