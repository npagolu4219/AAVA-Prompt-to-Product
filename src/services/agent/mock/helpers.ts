import type { A2uiMessage } from '@/types/a2ui'
import type { AgUiEvent, JsonPatchOp } from '@/types/agui'
import { AGENT_TIERS } from '@/config/roi'
import type { HitlDecision, Interrupt, RunInput, StepName } from '@/types/run'
import { uid } from '@/utils/format'
import { abortError } from '../types'

export interface ScriptContext {
  input: RunInput
  emit: (event: AgUiEvent) => void
  signal: AbortSignal
  ask: (interrupt: Interrupt) => Promise<HitlDecision>
}

export interface ToolSpec {
  name: string
  ms: number
  result: string
}

/** Small DSL that turns a scripted flow into AG-UI events. */
export function createScriptHelpers({ input, emit, signal, ask }: ScriptContext) {
  const ctx = input
  const speed = Math.max(0.25, input.options.speed)
  let currentStep: StepName | undefined

  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(abortError())
      const t = setTimeout(resolve, ms / speed)
      signal.addEventListener('abort', () => (clearTimeout(t), reject(abortError())), { once: true })
    })

  const say = async (text: string, msPerToken = 22) => {
    const messageId = uid('msg')
    emit({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' })
    for (const delta of text.match(/\S+\s*|\s+/g) ?? [text]) {
      emit({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta })
      await sleep(msPerToken)
    }
    emit({ type: 'TEXT_MESSAGE_END', messageId })
  }

  const tool = async ({ name, ms, result }: ToolSpec) => {
    const toolCallId = uid('tc')
    emit({ type: 'TOOL_CALL_START', toolCallId, toolCallName: name, parentStepName: currentStep })
    await sleep(ms)
    emit({ type: 'TOOL_CALL_END', toolCallId, result })
  }

  /** Fan-out: start all tools at once, finish in order of duration (wall-clock = slowest). */
  const parallel = async (tools: ToolSpec[]) => {
    const started = tools.map((t) => ({ ...t, id: uid('tc') }))
    for (const t of started) emit({ type: 'TOOL_CALL_START', toolCallId: t.id, toolCallName: t.name, parentStepName: currentStep })
    let elapsed = 0
    for (const t of [...started].sort((a, b) => a.ms - b.ms)) {
      await sleep(t.ms - elapsed)
      elapsed = t.ms
      emit({ type: 'TOOL_CALL_END', toolCallId: t.id, result: t.result })
    }
  }

  const step = async (name: StepName, body: () => Promise<string | void>) => {
    currentStep = name
    emit({ type: 'STEP_STARTED', stepName: name })
    await sleep(160)
    const summary = await body()
    emit({ type: 'STEP_FINISHED', stepName: name, summary: summary || undefined })
    currentStep = undefined
  }

  const skip = (stepName: StepName, reason: string) => emit({ type: 'CUSTOM', name: 'step_skipped', value: { stepName, reason } })

  const a2ui = (messages: A2uiMessage[]) => emit({ type: 'CUSTOM', name: 'a2ui', value: messages })

  const patch = (delta: JsonPatchOp[]) => emit({ type: 'STATE_DELTA', delta })

  const interrupt = (i: Omit<Interrupt, 'id'>) => {
    const full: Interrupt = { ...i, id: uid('int') }
    emit({ type: 'CUSTOM', name: 'interrupt', value: full })
    return ask(full)
  }

  /**
   * Report an agent's LLM usage. Deterministic agents (tier none) report zero tokens but still
   * log latency. Stable system/design context is prompt-cached after the first run in a thread.
   */
  const usage = (agent: string, inputTokens: number, outputTokens: number) => {
    const tier = AGENT_TIERS[agent] ?? 'small'
    const llm = tier !== 'none'
    const tokensIn = llm ? Math.round(inputTokens) : 0
    const cacheShare = ctx.project.length > 0 || ctx.mode === 'refine' ? 0.55 : 0.2
    emit({
      type: 'CUSTOM',
      name: 'usage',
      value: {
        agent,
        step: currentStep ?? 'Sense',
        tier,
        inputTokens: tokensIn,
        outputTokens: llm ? Math.round(outputTokens) : 0,
        cachedTokens: llm ? Math.round(tokensIn * cacheShare) : 0,
        latencyMs: llm ? Math.round(400 + outputTokens * 14) : Math.round(120 + inputTokens / 40),
      },
    })
  }

  return { sleep, say, tool, parallel, step, skip, a2ui, patch, interrupt, usage }
}

export type ScriptHelpers = ReturnType<typeof createScriptHelpers>
