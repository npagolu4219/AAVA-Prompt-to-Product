import { AGENT_URL } from '@/config/app'
import { HttpAgentClient } from './HttpAgentClient'
import { MockAgentClient } from './mock/MockAgentClient'
import type { AgentClient } from './types'

export function createAgentClient(): AgentClient {
  return AGENT_URL ? new HttpAgentClient(AGENT_URL) : new MockAgentClient()
}

export { isAbortError } from './types'
export type { AgentClient } from './types'
