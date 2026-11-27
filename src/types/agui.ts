/**
 * AG-UI event model (subset used by this workspace).
 * Mirrors the shapes from @ag-ui/core so the mock client can be swapped for
 * the real HttpAgent without touching the reducer.
 */
import type { A2uiMessage } from './a2ui'
import type { ContextUse } from './resources'
import type { UsageEntry } from './roi'
import type { Interrupt, RunMode, SharedState, StepName } from './run'

export type JsonPatchOp =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string }

export type AgUiCustomEvent =
  | { type: 'CUSTOM'; name: 'a2ui'; value: A2uiMessage[] }
  | { type: 'CUSTOM'; name: 'interrupt'; value: Interrupt }
  | { type: 'CUSTOM'; name: 'step_skipped'; value: { stepName: StepName; reason: string } }
  /** Deliver step: wire `fromScreenId`'s action to navigate to this run's screen. */
  | { type: 'CUSTOM'; name: 'screen_link'; value: { fromScreenId: string; action: string; label: string } }
  /** Sources the agent grounded on (codebase files, Figma library, docs…). */
  | { type: 'CUSTOM'; name: 'context_used'; value: ContextUse[] }
  /** LLM usage for one agent invocation (tokens, cache hits, latency) — feeds AI cost tracking. */
  | { type: 'CUSTOM'; name: 'usage'; value: UsageEntry }

export type AgUiEvent = { timestamp?: number } & (
  | { type: 'RUN_STARTED'; threadId: string; runId: string; mode: RunMode }
  | { type: 'RUN_FINISHED'; threadId: string; runId: string }
  | { type: 'RUN_ERROR'; message: string }
  | { type: 'STEP_STARTED'; stepName: StepName }
  | { type: 'STEP_FINISHED'; stepName: StepName; summary?: string }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; role: 'assistant' }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'TEXT_MESSAGE_END'; messageId: string }
  | { type: 'TOOL_CALL_START'; toolCallId: string; toolCallName: string; parentStepName?: StepName }
  | { type: 'TOOL_CALL_END'; toolCallId: string; result?: string }
  | { type: 'STATE_SNAPSHOT'; snapshot: SharedState }
  | { type: 'STATE_DELTA'; delta: JsonPatchOp[] }
  | AgUiCustomEvent
)

export type AgUiEventType = AgUiEvent['type']

export type EventCategory = 'lifecycle' | 'text' | 'tool' | 'state' | 'custom'

export const eventCategory = (type: AgUiEventType): EventCategory => {
  if (type.startsWith('RUN_') || type.startsWith('STEP_')) return 'lifecycle'
  if (type.startsWith('TEXT_')) return 'text'
  if (type.startsWith('TOOL_')) return 'tool'
  if (type.startsWith('STATE_')) return 'state'
  return 'custom'
}
