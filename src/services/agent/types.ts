import type { AgUiEvent } from '@/types/agui'
import type { HitlDecision, RunInput } from '@/types/run'

export type AgUiEventHandler = (event: AgUiEvent) => void

/**
 * The only contract the UI depends on. Two implementations:
 *  - MockAgentClient — scripted AAVA flow with dummy data (default)
 *  - HttpAgentClient — real AG-UI endpoint over SSE (set VITE_AGENT_URL)
 */
export interface AgentClient {
  readonly kind: 'mock' | 'http'
  run(input: RunInput, onEvent: AgUiEventHandler, signal: AbortSignal): Promise<void>
  resolveInterrupt(decision: HitlDecision): void | Promise<void>
}

export const abortError = () => new DOMException('Run aborted', 'AbortError')
export const isAbortError = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
