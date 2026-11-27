import { Component, useCallback, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { isBinding, type A2uiAction, type A2uiComponent, type SurfaceState } from '@/types/a2ui'
import { getAt } from '@/utils/jsonPatch'
import { AAVA_PLAY_CATALOG, isA2uiAction } from './catalog'
import styles from './Preview.module.scss'

interface Props {
  surface: SurfaceState
  onData: (path: string, value: unknown) => void
  onAction: (action: A2uiAction) => void
}

/**
 * Renders an A2UI surface by resolving each node against the AAVA Play catalog.
 * Unknown components are blocked (never rendered as raw markup) and flagged.
 */
export function A2uiSurface({ surface, onData, onAction }: Props) {
  const read = useCallback(<T,>(v: unknown, fallback: T): T => (isBinding(v) ? ((getAt(surface.dataModel, v.path) as T) ?? fallback) : ((v as T) ?? fallback)), [surface.dataModel])

  const render = (id: string, trail: Set<string>): ReactNode => {
    const node = surface.components[id]
    if (!node) return <div key={id} className={styles.skeleton} aria-hidden />
    if (trail.has(id)) return null // guard against cyclic children from a misbehaving agent
    const Comp = AAVA_PLAY_CATALOG[node.component]
    if (!Comp) return <BlockedNode key={id} node={node} />
    const next = new Set(trail).add(id)
    return (
      <Comp
        key={id}
        node={node}
        read={read}
        write={(value) => isBinding(node.value) && onData(node.value.path, value)}
        fire={(action) => isA2uiAction(action) && onAction({ event: { ...action.event, context: { ...surface.dataModel } } })}
      >
        {node.children?.map((c) => render(c, next))}
      </Comp>
    )
  }

  return (
    <SurfaceBoundary>
      <div className={styles.surface}>{render(surface.rootId, new Set())}</div>
    </SurfaceBoundary>
  )
}

function BlockedNode({ node }: { node: A2uiComponent }) {
  return (
    <div className={styles.blocked} role="note">
      <Icon name="shield" size={16} />
      <div>
        <strong>{node.component}</strong> is not in the AAVA Play catalog — blocked.
        <span>
          Node <code>#{node.id}</code>
          {node.label ? ` (“${String(node.label)}”)` : ''} · the Fixer will map it to an approved component.
        </span>
      </div>
    </div>
  )
}

class SurfaceBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A2UI surface failed to render', error, info)
  }

  render() {
    if (this.state.error)
      return (
        <div className={styles.blocked} role="alert">
          <Icon name="alert" size={16} />
          <div>
            <strong>Preview failed to render.</strong>
            <span>{this.state.error.message}</span>
          </div>
        </div>
      )
    return this.props.children
  }
}
