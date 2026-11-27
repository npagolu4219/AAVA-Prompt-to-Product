import { STEP_NAMES } from '@/config/app'
import type { A2uiComponent } from '@/types/a2ui'
import { eventCategory, type AgUiEvent, type EventCategory } from '@/types/agui'
import type { ScreenState } from '@/types/project'
import type { ThreadRecord } from '@/services/history/threadStore'
import type { UsageEntry } from '@/types/roi'
import type { ChatMessage, CollectionBinding, GenFile, HitlDecision, Interrupt, RunMode, RunSource, RunStatus, SharedState, StepName, StepState } from '@/types/run'
import { uid } from '@/utils/format'
import { applyPatch, setAt } from '@/utils/jsonPatch'
import { processA2uiMessages } from './a2uiProcessor'

export interface EventLogEntry {
  id: number
  at: number
  type: AgUiEvent['type']
  category: EventCategory
  label: string
  payload: AgUiEvent
}

export interface RunState {
  status: RunStatus
  mode: RunMode
  runId: string | null
  threadId: string
  steps: StepState[]
  messages: ChatMessage[]
  interrupt: Interrupt | null
  /** All screens in the project, in flow order (max 10). */
  screens: ScreenState[]
  activeScreenId: string | null
  /** Screen the current run is building/refining — AG-UI state events apply here. */
  runScreenId: string | null
  events: EventLogEntry[]
  startedAt: number | null
  finishedAt: number | null
  runCount: number
  /** Telemetry for the current run — written to the ROI ledger when it ends. */
  telemetry: RunTelemetry
}

export interface RunTelemetry {
  usage: UsageEntry[]
  hitlDecisions: number
  hitlWaitMs: number
  interruptAt: number | null
  /** Gap count of the first verification (before auto-fix). */
  firstGaps: number | null
}

const freshTelemetry = (): RunTelemetry => ({ usage: [], hitlDecisions: 0, hitlWaitMs: 0, interruptAt: null, firstGaps: null })

export type RunAction =
  | { type: 'run/begin'; prompt: string; mode: RunMode; screen?: ScreenState; targetId: string }
  | { type: 'run/event'; event: AgUiEvent }
  | { type: 'run/cancelled' }
  | { type: 'run/failed'; message: string }
  | { type: 'hitl/resolved'; decision: HitlDecision; label: string }
  /** `screenId` targets a specific screen (defaults to the active one). */
  | { type: 'files/edit'; path: string; content: string; screenId?: string }
  | { type: 'files/select'; path: string; screenId?: string }
  | { type: 'surface/setData'; path: string; value: unknown }
  | { type: 'surface/resetData' }
  | { type: 'chat/system'; content: string; tone?: ChatMessage['tone'] }
  | { type: 'screen/select'; id: string }
  | { type: 'screen/delete'; id: string }
  | { type: 'screen/link'; fromId: string; action: string; targetId: string | null }
  /** Confirmed new order from the Flow tab; optionally re-chain primary actions along it. */
  | { type: 'screen/reorder'; order: string[]; relink: boolean }
  | {
      type: 'screen/applyData'
      id: string
      components: A2uiComponent[]
      files: GenFile[]
      spec: string
      binding: CollectionBinding[]
      note: string
    }
  | { type: 'workspace/reset'; threadId?: string }
  | { type: 'workspace/load'; record: ThreadRecord }

const MAX_EVENTS = 400

export const emptyShared = (): SharedState => ({
  scenarioId: null,
  title: '',
  version: 0,
  files: [],
  previousFiles: [],
  spec: '',
  quality: null,
  changelog: [],
  bindings: [],
})

export const newScreen = (id: string, slug: string, source: RunSource): ScreenState => ({
  id,
  slug,
  route: `/${slug}`,
  source,
  surface: null,
  shared: emptyShared(),
  activeFile: null,
  links: [],
  editedPaths: [],
  signedOff: false,
  createdAt: Date.now(),
})

const freshSteps = (): StepState[] => STEP_NAMES.map((name) => ({ name, status: 'pending', iterations: 0, toolCalls: [] }))

const welcome = (): ChatMessage => ({
  id: uid('msg'),
  role: 'assistant',
  createdAt: Date.now(),
  content:
    'Hi! Describe a screen — or paste a **Figma link** — and I’ll plan it, build it from **AAVA Play** components with data from your **database**, verify it and hand you code. Keep going in this chat to build a flow of up to **10 screens**, then **Export** to Angular, React, Vue or HTML, or **Publish** to the cloud.',
})

export const createInitialRunState = (threadId: string = uid('thread')): RunState => ({
  status: 'idle',
  mode: 'full',
  runId: null,
  threadId,
  steps: freshSteps(),
  messages: [welcome()],
  interrupt: null,
  screens: [],
  activeScreenId: null,
  runScreenId: null,
  events: [],
  startedAt: null,
  finishedAt: null,
  runCount: 0,
  telemetry: freshTelemetry(),
})

// ---- selectors ----------------------------------------------------------------
export const selectActiveScreen = (s: RunState) => s.screens.find((x) => x.id === s.activeScreenId) ?? null
export const selectRunScreen = (s: RunState) => s.screens.find((x) => x.id === s.runScreenId) ?? null

/** First primary button action on a screen — the default edge when linking the next screen. */
const SIDE_ACTIONS = /^(export|cancel|sso|back|forgot|markAllRead|changeAvatar)/i

/** The action that most likely moves the user forward: primary button → other button → link → row/item click. */
export const primaryActionOf = (screen: ScreenState): string | undefined => {
  const nodes = Object.values(screen.surface?.components ?? {})
  const name = (c: (typeof nodes)[number]) => (c.action as { event?: { name?: string } } | undefined)?.event?.name
  const forward = (c: (typeof nodes)[number]) => Boolean(name(c)) && !SIDE_ACTIONS.test(name(c)!)
  const pick =
    nodes.find((c) => c.component === 'AavaButton' && c.variant === 'primary' && forward(c)) ??
    nodes.find((c) => c.component === 'AavaButton' && forward(c)) ??
    nodes.find((c) => c.component === 'AavaLink' && forward(c)) ??
    nodes.find((c) => (c.component === 'AavaTable' || c.component === 'AavaList') && forward(c))
  return pick ? name(pick) : undefined
}

/** All named actions on a screen (buttons, links, rows, list items). */
export const actionsOf = (screen: ScreenState) =>
  Object.values(screen.surface?.components ?? {})
    .map((c) => ({ id: c.id, label: String(c.label ?? c.text ?? c.id), name: (c.action as { event?: { name?: string } } | undefined)?.event?.name }))
    .filter((a): a is { id: string; label: string; name: string } => Boolean(a.name))

// ---- helpers -------------------------------------------------------------------
const updateStep = (steps: StepState[], name: StepName | undefined, fn: (s: StepState) => StepState) => steps.map((s) => (s.name === name ? fn(s) : s))

const runningStep = (steps: StepState[]) => steps.find((s) => s.status === 'running' || s.status === 'waiting')?.name

const updateScreen = (state: RunState, id: string | null, fn: (s: ScreenState) => ScreenState): RunState =>
  id ? { ...state, screens: state.screens.map((s) => (s.id === id ? fn(s) : s)) } : state

const ensureActiveFile = (active: string | null, shared: SharedState) => (active && shared.files.some((f) => f.path === active) ? active : (shared.files[0]?.path ?? null))

/** Drop a run's placeholder screen if it never got a surface (cancelled/failed early). */
function dropEmptyRunScreen(state: RunState): RunState {
  const s = selectRunScreen(state)
  if (!s || s.surface || state.mode !== 'full') return state
  const screens = state.screens.filter((x) => x.id !== s.id)
  return { ...state, screens, activeScreenId: state.activeScreenId === s.id ? (screens[screens.length - 1]?.id ?? null) : state.activeScreenId }
}

function eventLabel(e: AgUiEvent): string {
  switch (e.type) {
    case 'STEP_STARTED':
    case 'STEP_FINISHED':
      return e.stepName
    case 'TOOL_CALL_START':
      return e.toolCallName
    case 'TOOL_CALL_END':
      return e.result ?? ''
    case 'TEXT_MESSAGE_CONTENT':
      return JSON.stringify(e.delta)
    case 'STATE_DELTA':
      return e.delta.map((d) => `${d.op} ${d.path}`).join(', ')
    case 'CUSTOM':
      if (e.name === 'a2ui') return `a2ui · ${e.value.map((m) => Object.keys(m).find((k) => k !== 'version')).join(', ')}`
      if (e.name === 'interrupt') return `interrupt · ${e.value.title}`
      if (e.name === 'screen_link') return `screen_link · ${e.value.action} → ${e.value.label}`
      if (e.name === 'context_used') return `context_used · ${e.value.map((c) => c.name).join(', ')}`
      if (e.name === 'usage') return `usage · ${e.value.agent} · ${e.value.inputTokens + e.value.outputTokens} tok`
      return `${e.name} · ${e.value.stepName}`
    case 'RUN_ERROR':
      return e.message
    case 'RUN_STARTED':
      return `${e.mode} · ${e.runId}`
    default:
      return ''
  }
}

function reduceEvent(state: RunState, e: AgUiEvent): RunState {
  const now = e.timestamp ?? Date.now()
  const log: EventLogEntry = { id: (state.events[state.events.length - 1]?.id ?? 0) + 1, at: now, type: e.type, category: eventCategory(e.type), label: eventLabel(e), payload: e }
  const s: RunState = { ...state, events: [...state.events, log].slice(-MAX_EVENTS) }

  switch (e.type) {
    case 'RUN_STARTED':
      return { ...s, status: 'running', runId: e.runId, mode: e.mode, steps: freshSteps(), interrupt: null, startedAt: now, finishedAt: null, telemetry: freshTelemetry() }

    case 'RUN_FINISHED':
      return { ...s, status: 'finished', finishedAt: now, interrupt: null }

    case 'RUN_ERROR':
      return dropEmptyRunScreen({
        ...s,
        status: 'error',
        finishedAt: now,
        interrupt: null,
        steps: s.steps.map((st) => (st.status === 'running' || st.status === 'waiting' ? { ...st, status: 'error' } : st)),
        messages: [...s.messages, { id: uid('msg'), role: 'system', tone: 'danger', content: `Run failed: ${e.message}`, createdAt: now }],
      })

    case 'STEP_STARTED':
      return { ...s, steps: updateStep(s.steps, e.stepName, (st) => ({ ...st, status: 'running', iterations: st.iterations + 1, toolCalls: [], summary: undefined, startedAt: now, endedAt: undefined })) }

    case 'STEP_FINISHED':
      return { ...s, steps: updateStep(s.steps, e.stepName, (st) => ({ ...st, status: 'done', summary: e.summary, endedAt: now })) }

    case 'TEXT_MESSAGE_START':
      return { ...s, messages: [...s.messages, { id: e.messageId, role: 'assistant', content: '', createdAt: now, streaming: true }] }

    case 'TEXT_MESSAGE_CONTENT':
      return { ...s, messages: s.messages.map((m) => (m.id === e.messageId ? { ...m, content: m.content + e.delta } : m)) }

    case 'TEXT_MESSAGE_END':
      return { ...s, messages: s.messages.map((m) => (m.id === e.messageId ? { ...m, streaming: false } : m)) }

    case 'TOOL_CALL_START': {
      const step = e.parentStepName ?? runningStep(s.steps)
      return { ...s, steps: updateStep(s.steps, step, (st) => ({ ...st, toolCalls: [...st.toolCalls, { id: e.toolCallId, name: e.toolCallName, status: 'running', startedAt: now }] })) }
    }

    case 'TOOL_CALL_END':
      return {
        ...s,
        steps: s.steps.map((st) =>
          st.toolCalls.some((t) => t.id === e.toolCallId) ? { ...st, toolCalls: st.toolCalls.map((t) => (t.id === e.toolCallId ? { ...t, status: 'done', result: e.result, endedAt: now } : t)) } : st,
        ),
      }

    case 'STATE_SNAPSHOT':
      return updateScreen(s, s.runScreenId, (scr) => ({ ...scr, shared: e.snapshot, activeFile: ensureActiveFile(scr.activeFile, e.snapshot) }))

    case 'STATE_DELTA': {
      const q = e.delta.find((d) => d.path === '/quality' && d.op !== 'remove')
      const gaps = q && 'value' in q ? ((q.value as { gaps?: unknown[] } | null)?.gaps?.length ?? null) : null
      const withGaps = gaps !== null && s.telemetry.firstGaps === null ? { ...s, telemetry: { ...s.telemetry, firstGaps: gaps } } : s
      return updateScreen(withGaps, s.runScreenId, (scr) => {
        const shared = applyPatch(scr.shared, e.delta)
        const filesChanged = e.delta.some((d) => d.path === '/files')
        return { ...scr, shared, activeFile: ensureActiveFile(scr.activeFile, shared), editedPaths: filesChanged ? [] : scr.editedPaths }
      })
    }

    case 'CUSTOM':
      if (e.name === 'a2ui') return updateScreen(s, s.runScreenId, (scr) => ({ ...scr, surface: processA2uiMessages(scr.surface, e.value) }))
      if (e.name === 'step_skipped') return { ...s, steps: updateStep(s.steps, e.value.stepName, (st) => ({ ...st, status: 'skipped', summary: e.value.reason })) }
      if (e.name === 'screen_link') {
        const { fromScreenId, action, label } = e.value
        const target = s.runScreenId
        if (!target) return s
        return updateScreen(s, fromScreenId, (scr) => ({ ...scr, links: [...scr.links.filter((l) => l.action !== action), { action, label, targetId: target }] }))
      }
      if (e.name === 'usage') return { ...s, telemetry: { ...s.telemetry, usage: [...s.telemetry.usage, e.value] } }
      if (e.name === 'context_used')
        return { ...s, messages: [...s.messages, { id: uid('msg'), role: 'system', tone: 'info', content: '', context: e.value, createdAt: now }] }
      if (e.name === 'interrupt') {
        const step = runningStep(s.steps)
        return { ...s, status: 'waiting', interrupt: e.value, telemetry: { ...s.telemetry, interruptAt: now }, steps: step ? updateStep(s.steps, step, (st) => ({ ...st, status: 'waiting' })) : s.steps }
      }
      return s
  }
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'run/begin': {
      const screens = action.screen ? [...state.screens, action.screen] : state.screens
      return {
        ...state,
        status: 'running',
        mode: action.mode,
        runCount: state.runCount + 1,
        events: [],
        interrupt: null,
        screens,
        activeScreenId: action.targetId,
        runScreenId: action.targetId,
        steps: freshSteps(),
        messages: [...state.messages, { id: uid('msg'), role: 'user', content: action.prompt, createdAt: Date.now() }],
      }
    }

    case 'run/event':
      return reduceEvent(state, action.event)

    case 'run/cancelled':
      return dropEmptyRunScreen({
        ...state,
        status: 'cancelled',
        interrupt: null,
        finishedAt: Date.now(),
        steps: state.steps.map((st) => (st.status === 'running' || st.status === 'waiting' ? { ...st, status: 'error', summary: 'Cancelled' } : st)),
        messages: [
          ...state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
          { id: uid('msg'), role: 'system', tone: 'warning', content: 'Run stopped. Existing screens are kept as they were.', createdAt: Date.now() },
        ],
      })

    case 'run/failed':
      return reduceEvent(state, { type: 'RUN_ERROR', message: action.message })

    case 'hitl/resolved': {
      const { decision, label } = action
      const note = decision.note?.trim()
      const signs = state.interrupt?.kind === 'final' && decision.decision === 'approve'
      const next = signs ? updateScreen(state, state.runScreenId, (scr) => ({ ...scr, signedOff: true })) : state
      const t = next.telemetry
      return {
        ...next,
        status: 'running',
        interrupt: null,
        telemetry: { ...t, hitlDecisions: t.hitlDecisions + 1, hitlWaitMs: t.hitlWaitMs + (t.interruptAt ? Date.now() - t.interruptAt : 0), interruptAt: null },
        steps: next.steps.map((st) => (st.status === 'waiting' ? { ...st, status: 'running' } : st)),
        messages: [...next.messages, { id: uid('msg'), role: 'user', content: `**${label}**${note ? ` — ${note}` : ''}`, createdAt: Date.now() }],
      }
    }

    case 'files/edit':
      return updateScreen(state, action.screenId ?? state.activeScreenId, (scr) => ({
        ...scr,
        shared: { ...scr.shared, files: scr.shared.files.map((f) => (f.path === action.path ? { ...f, content: action.content } : f)) },
        editedPaths: scr.editedPaths.includes(action.path) ? scr.editedPaths : [...scr.editedPaths, action.path],
      }))

    case 'files/select':
      return updateScreen(state, action.screenId ?? state.activeScreenId, (scr) => ({ ...scr, activeFile: action.path }))

    case 'surface/setData':
      return updateScreen(state, state.activeScreenId, (scr) => (scr.surface ? { ...scr, surface: { ...scr.surface, dataModel: setAt(scr.surface.dataModel, action.path, action.value) } } : scr))

    case 'surface/resetData':
      return updateScreen(state, state.activeScreenId, (scr) => (scr.surface ? { ...scr, surface: { ...scr.surface, dataModel: structuredClone(scr.surface.initialDataModel) } } : scr))

    case 'chat/system':
      return { ...state, messages: [...state.messages, { id: uid('msg'), role: 'system', tone: action.tone ?? 'info', content: action.content, createdAt: Date.now() }] }

    case 'screen/select':
      return state.screens.some((s) => s.id === action.id) ? { ...state, activeScreenId: action.id } : state

    case 'screen/delete': {
      if (state.runScreenId === action.id && (state.status === 'running' || state.status === 'waiting')) return state
      const screens = state.screens
        .filter((s) => s.id !== action.id)
        .map((s) => ({ ...s, links: s.links.filter((l) => l.targetId !== action.id) }))
      const activeScreenId = state.activeScreenId === action.id ? (screens[screens.length - 1]?.id ?? null) : state.activeScreenId
      return { ...state, screens, activeScreenId, runScreenId: state.runScreenId === action.id ? null : state.runScreenId }
    }

    case 'screen/link':
      return updateScreen(state, action.fromId, (scr) => {
        const links = scr.links.filter((l) => l.action !== action.action)
        if (!action.targetId) return { ...scr, links }
        const label = state.screens.find((x) => x.id === action.targetId)?.shared.title ?? ''
        return { ...scr, links: [...links, { action: action.action, label, targetId: action.targetId }] }
      })

    case 'screen/reorder': {
      const byId = new Map(state.screens.map((s) => [s.id, s]))
      const ordered = action.order.map((id) => byId.get(id)).filter((s): s is ScreenState => Boolean(s))
      // Keep any screen the draft didn't mention (e.g. one still generating) at the end.
      const rest = state.screens.filter((s) => !action.order.includes(s.id))
      let screens = [...ordered, ...rest]
      if (action.relink) {
        screens = screens.map((scr, i) => {
          const primary = primaryActionOf(scr)
          if (!primary) return scr
          const others = scr.links.filter((l) => l.action !== primary)
          const next = screens[i + 1]
          return { ...scr, links: next ? [...others, { action: primary, label: next.shared.title, targetId: next.id }] : others }
        })
      }
      const path = screens.map((x, i) => `${i + 1}. ${x.shared.title}`).join(' → ')
      return {
        ...state,
        screens,
        messages: [
          ...state.messages,
          { id: uid('msg'), role: 'system', tone: 'success', content: `Flow reordered${action.relink ? ' and primary path re-linked' : ''}: ${path}`, createdAt: Date.now() },
        ],
      }
    }

    case 'screen/applyData':
      return updateScreen(state, action.id, (scr) => {
        if (!scr.surface) return scr
        const components = { ...scr.surface.components }
        for (const c of action.components) components[c.id] = c
        const version = scr.shared.version + 1
        const bindings = [...scr.shared.bindings.filter((b) => !action.binding.some((n) => n.componentId === b.componentId && n.prop === b.prop)), ...action.binding]
        return {
          ...scr,
          surface: { ...scr.surface, components, revision: scr.surface.revision + 1 },
          shared: { ...scr.shared, previousFiles: scr.shared.files, files: action.files, spec: action.spec, version, bindings, changelog: [...scr.shared.changelog, `v${version} — ${action.note}`] },
          editedPaths: [],
        }
      })

    case 'workspace/reset':
      return createInitialRunState(action.threadId)

    case 'workspace/load': {
      const r = action.record
      return {
        ...createInitialRunState(r.id),
        status: r.runCount ? 'finished' : 'idle',
        messages: r.messages.map((m) => ({ ...m, streaming: false })),
        screens: r.screens,
        activeScreenId: r.activeScreenId ?? r.screens[r.screens.length - 1]?.id ?? null,
        runCount: r.runCount,
      }
    }
  }
}
