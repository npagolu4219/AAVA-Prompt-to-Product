import { useMemo, useRef, useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { STORAGE_KEYS, THRESHOLDS } from '@/config/app'
import { useAutoScroll, useLocalStorage } from '@/hooks'
import { analyzeFiles } from '@/services/analysis/analyzeCode'
import { buildProject, stackMeta } from '@/services/export/stacks'
import { PROVIDER_FIELDS } from '@/services/publish/deployConfig'
import { PROVIDERS, publishClient } from '@/services/publish/publish'
import type { Deployment, DeployLog, StackId } from '@/types/export'
import type { ScreenState } from '@/types/project'
import { cx, formatClock, formatRelative } from '@/utils/format'
import { AnalysisReport } from '../export/AnalysisReport'
import { StackPicker } from '../export/StackPicker'
import { DeployConfigForm } from './DeployConfigForm'
import { useDeploySettings } from './useDeploySettings'
import styles from '../export/export.module.scss'

const STEPS = ['Tech stack', 'Provider & config', 'Preflight', 'Deploy']

interface Props {
  open: boolean
  onClose: () => void
}

/** Publish the multi-screen project to a cloud provider, gated by quality preflight checks. */
export function PublishDialog({ open, onClose }: Props) {
  const { state } = useRun()
  const screens = state.screens.filter((s) => s.surface)
  const [deploying, setDeploying] = useState(false)
  return (
    <Modal open={open} onClose={onClose} locked={deploying} title="Publish to cloud" subtitle={publishClient.kind === 'mock' ? 'Packages the real build artifact; the provider pipeline is simulated until VITE_PUBLISH_URL is set.' : 'Deploys through your AAVA deploy service.'} icon="cloud" flush>
      {screens.length === 0 ? <EmptyState icon="cloud" title="Nothing to publish yet" description="Generate and sign off at least one screen first." /> : <PublishWizard key={String(open)} screens={screens} onBusy={setDeploying} />}
    </Modal>
  )
}

function PublishWizard({ screens, onBusy }: { screens: ScreenState[]; onBusy: (b: boolean) => void }) {
  const { settings } = useTheme()
  const notify = useToast()
  const [history, setHistory] = useLocalStorage<{ items: Deployment[] }>(STORAGE_KEYS.deployments, { items: [] })
  const [step, setStep] = useState(0)
  const [stack, setStack] = useState<StackId | null>(null)
  const deploySettings = useDeploySettings()
  const provider = deploySettings.provider
  const providerValues = deploySettings.valuesFor(provider)
  const region = providerValues.region ?? PROVIDERS.find((p) => p.id === provider)!.regions[0]
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [env, setEnv] = useState<'preview' | 'production'>('preview')
  const [name, setName] = useState('aava-portal')
  const deployConfig = deploySettings.config(provider)
  const [logs, setLogs] = useState<DeployLog[]>([])
  const [result, setResult] = useState<Deployment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useAutoScroll<HTMLOListElement>(logs.length)

  const providerMeta = PROVIDERS.find((p) => p.id === provider)!

  const project = useMemo(
    () =>
      step >= 2 && stack
        ? buildProject(
            { stack, projectName: name, screenIds: screens.map((s) => s.id), includeData: true, includeTests: false, includeDocker: false, includeCi: false, aavaSource: 'portable', apiUrl: deploySettings.apiUrl, deploy: deployConfig },
            screens,
            settings,
          )
        : null,
    [step, stack, name, screens, settings, deploySettings.apiUrl, deployConfig],
  )
  const analysis = useMemo(() => (project ? analyzeFiles(project.files, { screens, routes: project.routes }) : null), [project, screens])

  const checks = useMemo(() => {
    const verified = screens.filter((s) => (s.shared.quality?.score ?? 0) >= THRESHOLDS.deliver)
    const gates = screens.filter((s) => s.shared.quality?.hardGates.every((g) => g.passed))
    const signed = screens.filter((s) => s.signedOff)
    return [
      { label: `Quality score ≥ ${THRESHOLDS.deliver} on every screen`, detail: `${verified.length}/${screens.length}`, ok: verified.length === screens.length, hard: true },
      { label: 'Hard gates pass (lint · a11y · raw colours)', detail: `${gates.length}/${screens.length}`, ok: gates.length === screens.length, hard: true },
      { label: 'Final sign-off (HITL ②) on every screen', detail: `${signed.length}/${screens.length}`, ok: signed.length === screens.length, hard: false },
      { label: 'Code analysis has no errors', detail: analysis ? `${analysis.counts.error} error(s)` : '…', ok: (analysis?.counts.error ?? 1) === 0, hard: false },
    ]
  }, [screens, analysis])

  const blocking = checks.filter((c) => !c.ok && (c.hard || env === 'production'))
  const missingRequired = PROVIDER_FIELDS[provider].filter((f) => f.required && !String(providerValues[f.key] ?? '').trim())
  const canNext = step === 0 ? Boolean(stack) : step === 1 ? name.length > 1 && missingRequired.length === 0 : step === 2 ? blocking.length === 0 : false

  const deploy = async () => {
    if (!project || !stack) return
    setStep(3)
    setLogs([])
    setResult(null)
    setError(null)
    setRunning(true)
    onBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const d = await publishClient.deploy(
        { provider, config: deployConfig, secrets, region, environment: env, projectName: name, stack, files: project.files, screens: screens.length },
        (l) => setLogs((x) => [...x, l]),
        ctrl.signal,
      )
      setResult(d)
      setHistory((h) => ({ items: [d, ...h.items].slice(0, 12) }))
      notify(`Published to ${providerMeta.name}`, 'success')
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'AbortError' ? 'Deployment cancelled' : e instanceof Error ? e.message : String(e)
      setError(msg)
      setLogs((x) => [...x, { at: Date.now(), stage: 'error', message: msg, level: 'error' }])
    } finally {
      setRunning(false)
      onBusy(false)
      abortRef.current = null
      setSecrets({}) // credentials are single-use
    }
  }

  return (
    <div className={styles.wizard}>
      <ol className={styles.wizardSteps} aria-label="Publish steps">
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
            <p className={styles.lead}>Which tech stack should be built and deployed? All {screens.length} screen(s) ship as one app with routing between them.</p>
            <StackPicker value={stack} onChange={setStack} />
          </>
        )}

        {step === 1 && stack && (
          <div className={styles.configure}>
            <div className={styles.row2}>
              <label className={styles.field}>
                <span>App name</span>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40))} spellCheck={false} />
              </label>
              <div className={styles.field}>
                <span>Environment</span>
                <SegmentedControl
                  label="Environment"
                  block
                  value={env}
                  onChange={setEnv}
                  options={[
                    { value: 'preview', label: 'Preview', icon: 'eye' },
                    { value: 'production', label: 'Production', icon: 'rocket' },
                  ]}
                />
              </div>
            </div>
            <span className={styles.hint}>Production requires every preflight check to pass; preview only requires the hard quality gates.</span>
            <DeployConfigForm settings={deploySettings} stack={stack} projectName={name} environment={env} secrets={secrets} onSecret={(k, v) => setSecrets((x) => ({ ...x, [k]: v }))} />
            {missingRequired.length > 0 && (
              <p className={styles.note}>
                <Icon name="alert" size={14} /> Required: {missingRequired.map((f) => f.label).join(', ')}
              </p>
            )}
          </div>
        )}

        {step === 2 && analysis && (
          <div className={styles.review}>
            <ul className={styles.checks}>
              {checks.map((c) => {
                const blocks = !c.ok && (c.hard || env === 'production')
                return (
                  <li key={c.label} className={cx(styles.check, c.ok ? styles.checkOk : blocks ? styles.checkFail : styles.checkWarn)}>
                    <Icon name={c.ok ? 'check' : 'alert'} size={15} strokeWidth={c.ok ? 3 : 2} />
                    <span>{c.label}</span>
                    <Badge size="sm" tone={c.ok ? 'success' : blocks ? 'danger' : 'warning'}>
                      {c.detail}
                    </Badge>
                  </li>
                )
              })}
            </ul>
            {blocking.length > 0 && (
              <p className={styles.note}>
                <Icon name="alert" size={14} /> {blocking.length} check(s) block a {env} deploy. Fix them by refining or signing off screens{env === 'production' ? ', or deploy to Preview' : ''}.
              </p>
            )}
            <AnalysisReport analysis={analysis} compact />
          </div>
        )}

        {step === 3 && (
          <div className={styles.deploy}>
            <div className={styles.deployHead}>
              <span className={cx(styles.deployState, running ? styles.dsRun : result ? styles.dsOk : styles.dsFail)}>
                <Icon name={running ? 'refresh' : result ? 'check' : 'alert'} size={16} />
                {running ? 'Deploying…' : result ? 'Live' : 'Failed'}
              </span>
              <span>
                {providerMeta.name} · {region} · {env} · {stack && stackMeta(stack).name}
              </span>
            </div>
            <ol ref={logRef} className={styles.log}>
              {logs.map((l, i) => (
                <li key={i} className={styles[`log_${l.level}`]}>
                  <span className={styles.logTime}>{formatClock(l.at)}</span>
                  <span className={styles.logStage}>{l.stage}</span>
                  <span>{l.message}</span>
                </li>
              ))}
            </ol>
            {result && (
              <div className={styles.liveCard}>
                <Icon name="rocket" size={20} />
                <div>
                  <strong>{result.url}</strong>
                  <span>
                    {result.screens} screens · {result.sizeKb} KB {result.simulated ? '· simulated deployment (mock provider)' : ''}
                  </span>
                </div>
                <Button
                  size="sm"
                  icon="copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(result.url)
                    notify('URL copied', 'success')
                  }}
                >
                  Copy
                </Button>
                {!result.simulated && (
                  <a className={styles.openLink} href={result.url} target="_blank" rel="noreferrer">
                    Open <Icon name="external" size={13} />
                  </a>
                )}
              </div>
            )}
            {error && <p className={styles.note}>{error}</p>}
          </div>
        )}

        {(step === 0 || step === 3) && history.items.length > 0 && (
          <section className={styles.history}>
            <h4>Recent deployments</h4>
            <ul>
              {history.items.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Badge size="sm" tone={d.environment === 'production' ? 'success' : 'info'}>
                    {d.environment}
                  </Badge>
                  <code>{d.url}</code>
                  <span>
                    {PROVIDERS.find((p) => p.id === d.provider)?.name} · {stackMeta(d.stack).name} · {formatRelative(d.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className={styles.wizardFoot}>
        {step > 0 && step < 3 && (
          <Button variant="ghost" icon="chevronLeft" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step === 3 && running && (
          <Button variant="danger" icon="stop" onClick={() => abortRef.current?.abort()}>
            Cancel
          </Button>
        )}
        {step === 3 && !running && (
          <Button variant="ghost" icon="refresh" onClick={() => setStep(2)}>
            Back to preflight
          </Button>
        )}
        <span className={styles.spacer} />
        {step < 2 && (
          <Button variant="primary" iconRight="arrowRight" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            {step === 0 ? (stack ? `Use ${stackMeta(stack).name}` : 'Choose a stack') : 'Run preflight'}
          </Button>
        )}
        {step === 2 && (
          <Button variant="primary" icon="rocket" disabled={!canNext} onClick={deploy}>
            Deploy to {env}
          </Button>
        )}
      </div>
    </div>
  )
}
