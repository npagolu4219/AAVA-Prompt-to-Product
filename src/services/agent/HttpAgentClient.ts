import type { AgUiEvent } from '@/types/agui'
import type { HitlDecision, RunInput } from '@/types/run'
import { uid } from '@/utils/format'
import type { AgentClient, AgUiEventHandler } from './types'

/**
 * Talks to a real AG-UI endpoint (e.g. the FastAPI BFF from slide 24) over SSE.
 * Equivalent to @ag-ui/client's HttpAgent; kept dependency-free here.
 *
 * BFF contract:
 *   POST {url}          RunAgentInput → text/event-stream of AG-UI events
 *   POST {url}/resume   HitlDecision  → resumes an interrupted run
 */
export class HttpAgentClient implements AgentClient {
  readonly kind = 'http' as const
  private readonly url: string

  constructor(url: string) {
    this.url = url.replace(/\/$/, '')
  }

  async run(input: RunInput, onEvent: AgUiEventHandler, signal: AbortSignal) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        threadId: input.threadId,
        runId: uid('run'),
        messages: [{ id: uid('msg'), role: 'user', content: input.prompt }],
        state: {},
        tools: [],
        context: [],
        // The BFF moves the Figma token into the vault and strips it before anything reaches the LLM.
        forwardedProps: { mode: input.mode, figma: input.figma, options: input.options, refine: input.context },
      }),
      signal,
    })
    if (!res.ok || !res.body) throw new Error(`AG-UI endpoint responded ${res.status}`)

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const data = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n')
        if (data) onEvent(JSON.parse(data) as AgUiEvent)
      }
    }
  }

  async resolveInterrupt(decision: HitlDecision) {
    await fetch(`${this.url}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision),
    })
  }
}
