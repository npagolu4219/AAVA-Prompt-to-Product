import { useMemo } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { STEP_NAMES } from '@/config/app'
import type { StepName, StepState } from '@/types/run'

export type BuildPhase = 'planning' | 'composing' | 'verifying' | 'delivering'

export const PHASE_COPY: Record<BuildPhase, string> = {
  planning: 'Understanding intent & planning layout',
  composing: 'Composing A2UI & compiling Angular',
  verifying: 'Verifying · critic · a11y · lint · Playwright',
  delivering: 'Delivering · linking flow · analysing code',
}

const live = (s?: StepState) => s?.status === 'running' || s?.status === 'waiting'

/** Derives the visual build phase of the active screen from the AG-UI step stream. */
export function useBuildPhase() {
  const { state, activeScreen } = useRun()
  return useMemo(() => {
    const running = state.status === 'running' || state.status === 'waiting'
    const building = running && Boolean(activeScreen) && activeScreen?.id === state.runScreenId
    const step = (n: StepName) => state.steps.find((s) => s.name === n)
    const done = state.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length
    const progress = Math.min(1, (done + (state.steps.some(live) ? 0.5 : 0)) / STEP_NAMES.length)
    let phase: BuildPhase | null = null
    if (building) {
      const act = step('Act')
      if (!activeScreen?.surface || act?.status === 'pending') phase = 'planning'
      else if (live(act)) phase = 'composing'
      else if (live(step('Verify')) || live(step('Refine'))) phase = 'verifying'
      else phase = 'delivering'
    }
    const verifyCalls = step('Verify')?.toolCalls ?? []
    const current = state.steps.find(live)
    return { building, phase, progress, current, verifyCalls, waiting: state.status === 'waiting', interrupt: state.interrupt, mode: state.mode, runId: state.runId }
  }, [state.status, state.steps, state.runScreenId, state.interrupt, state.mode, state.runId, activeScreen])
}
