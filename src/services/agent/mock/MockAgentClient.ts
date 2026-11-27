import type { AgUiEvent } from '@/types/agui'
import type { HitlDecision, Interrupt, RunInput } from '@/types/run'
import { abortError, isAbortError, type AgentClient, type AgUiEventHandler } from '../types'
import { runFullFlow, runRefineFlow } from './flows'

/** In-browser stand-in for the AAVA AG-UI endpoint. */
export class MockAgentClient implements AgentClient {
  readonly kind = 'mock' as const
  private pending = new Map<string, (d: HitlDecision) => void>()

  async run(input: RunInput, onEvent: AgUiEventHandler, signal: AbortSignal) {
    const emit = (event: AgUiEvent) => {
      if (!signal.aborted) onEvent({ ...event, timestamp: Date.now() })
    }
    const ask = (interrupt: Interrupt) =>
      new Promise<HitlDecision>((resolve, reject) => {
        this.pending.set(interrupt.id, resolve)
        signal.addEventListener('abort', () => (this.pending.delete(interrupt.id), reject(abortError())), { once: true })
      })

    const ctx = { input, emit, signal, ask }
    try {
      await (input.mode === 'refine' && input.context ? runRefineFlow(ctx) : runFullFlow(ctx))
    } catch (e) {
      if (isAbortError(e)) throw e
      emit({ type: 'RUN_ERROR', message: e instanceof Error ? e.message : String(e) })
    }
  }

  resolveInterrupt(decision: HitlDecision) {
    const resolve = this.pending.get(decision.interruptId)
    if (!resolve) return
    this.pending.delete(decision.interruptId)
    resolve(decision)
  }
}
