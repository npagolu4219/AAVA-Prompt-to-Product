import { useCallback, useEffect, useRef, useState } from 'react'
import { refinePrompt, type RefineContext, type RefineMode, type RefineResult } from '@/services/agent/promptRefiner'
import { isAbortError } from '@/services/agent/types'

export type RefinePhase = 'idle' | 'thinking' | 'streaming' | 'done'

const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Drives a prompt refinement: think (request) → stream (typewriter into the field) → done.
 * Keeps the pre-refine text so the user can undo, and cancels cleanly if they type.
 */
export function usePromptRefiner(value: string, onChange: (v: string) => void, ctx: RefineContext) {
  const [phase, setPhase] = useState<RefinePhase>('idle')
  const [mode, setMode] = useState<RefineMode | null>(null)
  const [result, setResult] = useState<RefineResult | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const timer = useRef<number | null>(null)
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  const stopStream = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }

  const cancel = useCallback(() => {
    ctrl.current?.abort()
    stopStream()
    setPhase('idle')
    setMode(null)
  }, [])

  useEffect(() => () => (ctrl.current?.abort(), stopStream()), [])

  const refine = useCallback(
    async (m: RefineMode) => {
      const source = value.trim()
      if (source.length < 3) return
      ctrl.current?.abort()
      stopStream()
      const ac = new AbortController()
      ctrl.current = ac
      setMode(m)
      setResult(null)
      setPhase('thinking')
      try {
        const r = await refinePrompt(source, m, ctxRef.current, ac.signal)
        if (ac.signal.aborted) return
        // Keep the very first original across "refine again" so undo goes all the way back.
        const res = { ...r, original: result && value === result.text ? result.original : source }
        setResult(res)
        if (reducedMotion()) {
          onChange(res.text)
          setPhase('done')
          return
        }
        setPhase('streaming')
        let i = 0
        const step = Math.max(2, Math.round(res.text.length / 70))
        timer.current = window.setInterval(() => {
          i = Math.min(res.text.length, i + step)
          onChange(res.text.slice(0, i))
          if (i >= res.text.length) {
            stopStream()
            setPhase('done')
          }
        }, 16)
      } catch (e) {
        if (!isAbortError(e)) setPhase('idle')
      }
    },
    [value, onChange, result],
  )

  const undo = useCallback(() => {
    if (!result) return
    cancel()
    onChange(result.original)
    setResult(null)
  }, [result, cancel, onChange])

  const dismiss = useCallback(() => {
    setResult(null)
    setPhase('idle')
    setMode(null)
  }, [])

  return { phase, mode, result, busy: phase === 'thinking' || phase === 'streaming', refine, undo, cancel, dismiss }
}
