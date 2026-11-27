import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * FLIP animation for keyed lists: when items change position between renders,
 * they glide from their old spot to the new one instead of jumping.
 */
export function useFlip(order: string[], duration = 360) {
  const nodes = useRef(new Map<string, HTMLElement>())
  const last = useRef(new Map<string, DOMRect>())

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(id, el)
      else nodes.current.delete(id)
    },
    [],
  )

  const key = order.join('|')

  useLayoutEffect(() => {
    const reduce = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, DOMRect>()
    nodes.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect()
      next.set(id, rect)
      const prev = last.current.get(id)
      if (!prev || reduce) return
      const dx = prev.left - rect.left
      const dy = prev.top - rect.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
    })
    last.current = next
  }, [key, duration])

  return register
}
