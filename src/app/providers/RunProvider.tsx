import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { DEFAULT_RUN_OPTIONS, MAX_SCREENS, STORAGE_KEYS } from '@/config/app'
import { getScenario, resolveScenario } from '@/data/scenarios'
import { useLocalStorage } from '@/hooks'
import { createAgentClient, isAbortError } from '@/services/agent'
import { generateAngularFiles } from '@/services/codegen/angular'
import { generateSpec } from '@/services/codegen/spec'
import { mapRowsToComponent, type BindableProp, type ColumnMapping } from '@/services/datasource/bindings'
import { createInitialRunState, newScreen, primaryActionOf, runReducer, selectActiveScreen, type RunState } from '@/state/runReducer'
import type { A2uiAction } from '@/types/a2ui'
import type { ScreenState } from '@/types/project'
import type { FigmaRef, HitlChoice, RunOptions } from '@/types/run'
import { parseFigmaUrl, uid } from '@/utils/format'
import { useDataSources } from './DataSourceProvider'
import { useHistory } from './HistoryProvider'
import { useLedger } from './LedgerProvider'
import { complexityOf } from '@/services/roi/engine'
import type { RunOutcome } from '@/types/roi'
import { useResources } from './ResourcesProvider'
import { useToast } from './ToastProvider'

export type StartMode = 'new' | 'refine'

export interface BindRequest {
  componentId: string
  prop: BindableProp
  table: string
  limit: number
  mapping: ColumnMapping
}

interface RunApi {
  state: RunState
  activeScreen: ScreenState | null
  options: RunOptions
  agentKind: 'mock' | 'http'
  isBusy: boolean
  canAddScreen: boolean
  setOptions: (patch: Partial<RunOptions>) => void
  /** `fresh` starts a brand-new conversation (e.g. from the landing page). */
  start: (prompt: string, figma?: FigmaRef, mode?: StartMode, opts?: { fresh?: boolean }) => void
  /** Reopen a saved conversation from chat history. */
  openThread: (id: string) => Promise<boolean>
  stop: () => void
  resolve: (decision: HitlChoice, note?: string) => void
  editFile: (path: string, content: string, screenId?: string) => void
  selectFile: (path: string, screenId?: string) => void
  setData: (path: string, value: unknown) => void
  resetData: () => void
  sendSurfaceAction: (action: A2uiAction) => void
  selectScreen: (id: string) => void
  deleteScreen: (id: string) => void
  linkScreens: (fromId: string, action: string, targetId: string | null) => void
  reorderScreens: (order: string[], relink: boolean) => void
  bindData: (req: BindRequest) => Promise<void>
  resetWorkspace: () => void
}

const RunContext = createContext<RunApi | null>(null)

const DECISION_LABEL: Record<HitlChoice, string> = { approve: '✓ Approved', edit: '✎ Edited', reject: '✕ Rejected' }

const uniqueSlug = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base
  let i = 2
  while (taken.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/** Connects the agent client (mock or AG-UI HTTP) to the project/run reducer. */
export function RunProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, undefined, createInitialRunState)
  const [options, setOptionsState] = useLocalStorage<RunOptions>(STORAGE_KEYS.runOptions, DEFAULT_RUN_OPTIONS)
  const { active: dataSource, query } = useDataSources()
  const { refsFor } = useResources()
  const history = useHistory()
  const ledger = useLedger()
  const recordedRuns = useRef(new Set<string>())
  const client = useMemo(() => createAgentClient(), [])
  const abortRef = useRef<AbortController | null>(null)
  const stateRef = useRef(state)
  const notify = useToast()

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => () => abortRef.current?.abort(), [])

  const start = useCallback(
    async (prompt: string, figma?: FigmaRef, requested?: StartMode, opts?: { fresh?: boolean }) => {
      if (abortRef.current) return
      let current = stateRef.current
      if (opts?.fresh && current.runCount > 0) {
        current = createInitialRunState()
        dispatch({ type: 'workspace/reset', threadId: current.threadId })
        stateRef.current = current
      }
      const active = selectActiveScreen(current)
      const canRefine = Boolean(active?.surface && active.shared.scenarioId && active.shared.files.length)
      const mode = requested === 'refine' && canRefine && !figma ? 'refine' : 'full'

      if (mode === 'full' && current.screens.length >= MAX_SCREENS) {
        dispatch({ type: 'chat/system', tone: 'warning', content: `This project already has ${MAX_SCREENS} screens — delete one in the **Flow** tab or refine an existing screen.` })
        return
      }

      // Reserve the screen slot for a new screen; refine targets the active one.
      let screenRef: { id: string; slug: string; index: number; max: number }
      let placeholder: ScreenState | undefined
      if (mode === 'full') {
        const sc = resolveScenario(prompt, Boolean(figma))
        const id = uid('scr')
        const slug = uniqueSlug(sc.slug, current.screens.map((s) => s.slug))
        const figmaInfo = figma ? parseFigmaUrl(figma.url) : null
        placeholder = newScreen(id, slug, figma ? { kind: 'figma', label: figmaInfo?.nodeId ? `Figma · ${figmaInfo.nodeId}` : 'Figma frame' } : { kind: 'prompt', label: 'Prompt' })
        screenRef = { id, slug, index: current.screens.length, max: MAX_SCREENS }
      } else {
        screenRef = { id: active!.id, slug: active!.slug, index: current.screens.indexOf(active!), max: MAX_SCREENS }
      }

      const display = figma ? `${prompt}\n\n🔗 Figma: \`${figma.url.replace(/^https?:\/\//, '').slice(0, 48)}…\` · token stored in vault` : prompt
      dispatch({ type: 'run/begin', prompt: display, mode, screen: placeholder, targetId: screenRef.id })

      const controller = new AbortController()
      abortRef.current = controller
      try {
        await client.run(
          {
            threadId: current.threadId,
            prompt,
            mode,
            figma,
            options,
            screen: screenRef,
            project: current.screens
              .filter((s) => s.id !== screenRef.id && s.surface)
              .map((s) => ({ id: s.id, title: s.shared.title, slug: s.slug, route: s.route, primaryAction: primaryActionOf(s) })),
            dataSource: dataSource ? { id: dataSource.id, name: dataSource.name, kind: dataSource.kind } : null,
            resources: refsFor(prompt),
            context:
              mode === 'refine' && active?.surface && active.shared.scenarioId
                ? {
                    scenarioId: active.shared.scenarioId,
                    components: Object.values(active.surface.components),
                    dataModel: active.surface.dataModel,
                    version: active.shared.version,
                    quality: active.shared.quality,
                    files: active.shared.files,
                    changelog: active.shared.changelog,
                    bindings: active.shared.bindings,
                  }
                : undefined,
          },
          (event) => dispatch({ type: 'run/event', event }),
          controller.signal,
        )
      } catch (err) {
        if (isAbortError(err)) dispatch({ type: 'run/cancelled' })
        else dispatch({ type: 'run/failed', message: err instanceof Error ? err.message : String(err) })
      } finally {
        abortRef.current = null
      }
    },
    [client, options, dataSource, refsFor],
  )

  // Autosave the conversation to chat history whenever it settles (never mid-run).
  useEffect(() => {
    if (state.runCount === 0 || state.status === 'running' || state.status === 'waiting') return
    const firstPrompt = state.messages.find((m) => m.role === 'user')?.content.split('\n')[0] ?? 'Untitled'
    const t = setTimeout(() => {
      const existing = history.threads.find((x) => x.id === state.threadId)
      void history.save({
        id: state.threadId,
        title: existing?.title ?? (firstPrompt.length > 60 ? `${firstPrompt.slice(0, 57)}…` : firstPrompt),
        createdAt: existing?.createdAt ?? state.messages[0]?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        messages: state.messages.filter((m) => !m.streaming),
        screens: state.screens.filter((x) => x.surface),
        activeScreenId: state.activeScreenId,
        runCount: state.runCount,
      })
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.runCount, state.screens, state.messages.length, state.threadId])

  // Write one ROI ledger row per run when it ends (delivered, draft, escalated, cancelled or failed).
  useEffect(() => {
    const ended = state.status === 'finished' || state.status === 'cancelled' || state.status === 'error'
    if (!ended || !state.runId || recordedRuns.current.has(state.runId)) return
    recordedRuns.current.add(state.runId)
    const screen = state.screens.find((x) => x.id === state.runScreenId)
    const q = screen?.shared.quality ?? null
    const nodes = Object.values(screen?.surface?.components ?? {}).filter((c) => !['Column', 'Row', 'Grid'].includes(c.component))
    const outcome: RunOutcome =
      state.status === 'cancelled' ? 'cancelled' : state.status === 'error' ? 'error' : screen?.signedOff ? 'delivered' : q?.decision === 'escalate' ? 'escalated' : screen?.surface ? 'draft' : 'cancelled'
    const t = state.telemetry
    const firstTitle = history.threads.find((x) => x.id === state.threadId)?.title ?? state.messages.find((m) => m.role === 'user')?.content.split('\n')[0].slice(0, 60) ?? 'Untitled'
    ledger.record({
      id: state.runId,
      threadId: state.threadId,
      project: firstTitle,
      screenId: screen?.id ?? null,
      screenTitle: screen?.shared.title || 'Untitled screen',
      scenarioId: screen?.shared.scenarioId ?? null,
      mode: state.mode,
      startedAt: state.startedAt ?? Date.now(),
      finishedAt: state.finishedAt ?? Date.now(),
      durationMs: Math.max(0, (state.finishedAt ?? Date.now()) - (state.startedAt ?? Date.now()) - t.hitlWaitMs),
      outcome,
      usage: t.usage,
      hitlDecisions: t.hitlDecisions,
      hitlWaitMs: t.hitlWaitMs,
      components: nodes.length,
      complexity: complexityOf(nodes.length),
      filesGenerated: screen?.shared.files.length ?? 0,
      loc: (screen?.shared.files ?? []).filter((f) => !f.path.startsWith('verify/')).reduce((n, f) => n + f.content.split('\n').filter((l) => l.trim()).length, 0),
      qualityScore: q?.score ?? null,
      firstPassScore: q?.history[0] ?? null,
      iterations: q?.iteration ?? 0,
      gapsAutoFixed: Math.max(0, (t.firstGaps ?? 0) - (q?.gaps.length ?? 0)),
      gapsRemaining: q?.gaps.length ?? 0,
      hardGatesPassed: q?.hardGates.every((g) => g.passed) ?? false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.runId])

  const openThread = useCallback(
    async (id: string) => {
      abortRef.current?.abort()
      const record = await history.get(id)
      if (!record) return false
      dispatch({ type: 'workspace/load', record })
      return true
    },
    [history],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const resolve = useCallback(
    (decision: HitlChoice, note?: string) => {
      const interrupt = stateRef.current.interrupt
      if (!interrupt) return
      const label = interrupt.labels?.[decision] ? `${DECISION_LABEL[decision].split(' ')[0]} ${interrupt.labels[decision]}` : DECISION_LABEL[decision]
      dispatch({ type: 'hitl/resolved', decision: { interruptId: interrupt.id, decision, note }, label })
      void client.resolveInterrupt({ interruptId: interrupt.id, decision, note })
    },
    [client],
  )

  /** Preview clicks: follow the flow link if one exists (prototype mode), else forward to the agent. */
  const sendSurfaceAction = useCallback(
    (action: A2uiAction) => {
      const s = stateRef.current
      const screen = selectActiveScreen(s)
      const name = action.event.name
      const link = screen?.links.find((l) => l.action === name)
      const target = link && s.screens.find((x) => x.id === link.targetId)
      if (target) {
        dispatch({ type: 'screen/select', id: target.id })
        notify(`${name} → ${target.shared.title}`, 'info')
        return
      }
      dispatch({ type: 'chat/system', content: `Preview action \`${name}\` → sent to agent via AG-UI${action.event.context ? ` with ${Object.keys(action.event.context).length} field(s)` : ''}. Link it to a screen in the **Flow** tab to navigate.` })
      notify(`Action “${name}” sent to agent`, 'info')
    },
    [notify],
  )

  /** Manual DB → component binding: query, map rows, recompile code + spec deterministically. */
  const bindData = useCallback(
    async (req: BindRequest) => {
      const s = stateRef.current
      const screen = selectActiveScreen(s)
      const node = screen?.surface?.components[req.componentId]
      if (!screen || !node || !dataSource || !screen.shared.scenarioId) throw new Error('Select a screen with a bindable component and connect a database first.')
      const rows = await query(dataSource.id, req.table, req.limit)
      const updated = mapRowsToComponent(node, req.prop, rows, req.mapping)
      const components = Object.values(screen.surface!.components).map((c) => (c.id === updated.id ? updated : c))
      const binding = [{ componentId: req.componentId, prop: req.prop, table: req.table, source: dataSource.name, rowCount: rows.length }]
      const bindings = [...screen.shared.bindings.filter((b) => !(b.componentId === req.componentId && b.prop === req.prop)), ...binding]
      const version = screen.shared.version + 1
      const sc = getScenario(screen.shared.scenarioId)
      const files = generateAngularFiles({ slug: screen.slug, title: screen.shared.title, components, dataModel: screen.surface!.dataModel, version, bindings })
      const note = `data binding: ${req.componentId}.${req.prop} ← ${req.table} (${rows.length} rows)`
      const spec = generateSpec({ scenario: sc, plan: sc.plan, planNotes: [], components, dataModel: screen.surface!.dataModel, version, source: screen.source, quality: screen.shared.quality, changelog: [...screen.shared.changelog, `v${version} — ${note}`], bindings, route: screen.route })
      dispatch({ type: 'screen/applyData', id: screen.id, components: [updated], files, spec, binding, note })
      dispatch({ type: 'chat/system', tone: 'success', content: `Imported **${rows.length} rows** from \`${req.table}\` into \`${req.componentId}\` on ${screen.shared.title} → v${version}.` })
      notify(`Bound ${req.table} → ${req.componentId}`, 'success')
    },
    [dataSource, query, notify],
  )

  const activeScreen = selectActiveScreen(state)

  const api = useMemo<RunApi>(
    () => ({
      state,
      activeScreen,
      options,
      agentKind: client.kind,
      isBusy: state.status === 'running' || state.status === 'waiting',
      canAddScreen: state.screens.length < MAX_SCREENS,
      setOptions: (patch) => setOptionsState((o) => ({ ...o, ...patch })),
      start: (p, f, m, o) => void start(p, f, m, o),
      openThread,
      stop,
      resolve,
      editFile: (path, content, screenId) => dispatch({ type: 'files/edit', path, content, screenId }),
      selectFile: (path, screenId) => dispatch({ type: 'files/select', path, screenId }),
      setData: (path, value) => dispatch({ type: 'surface/setData', path, value }),
      resetData: () => dispatch({ type: 'surface/resetData' }),
      sendSurfaceAction,
      selectScreen: (id) => dispatch({ type: 'screen/select', id }),
      deleteScreen: (id) => dispatch({ type: 'screen/delete', id }),
      linkScreens: (fromId, action, targetId) => dispatch({ type: 'screen/link', fromId, action, targetId }),
      reorderScreens: (order, relink) => dispatch({ type: 'screen/reorder', order, relink }),
      bindData,
      resetWorkspace: () => {
        abortRef.current?.abort()
        dispatch({ type: 'workspace/reset' })
      },
    }),
    [state, activeScreen, options, client.kind, setOptionsState, start, openThread, stop, resolve, sendSurfaceAction, bindData],
  )

  return <RunContext.Provider value={api}>{children}</RunContext.Provider>
}

export function useRun() {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('useRun must be used inside <RunProvider>')
  return ctx
}
