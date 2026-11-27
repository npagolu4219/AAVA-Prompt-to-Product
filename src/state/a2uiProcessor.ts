import type { A2uiMessage, SurfaceState } from '@/types/a2ui'
import { setAt } from '@/utils/jsonPatch'

/**
 * Pure equivalent of A2uiRendererService.processMessages():
 * folds a batch of A2UI v0.9 messages into the current surface state.
 */
export function processA2uiMessages(surface: SurfaceState | null, messages: A2uiMessage[]): SurfaceState | null {
  let s = surface
  for (const m of messages) {
    if ('createSurface' in m) {
      s = {
        surfaceId: m.createSurface.surfaceId,
        catalogId: m.createSurface.catalogId ?? 'aava-play@1',
        rootId: 'root',
        components: {},
        dataModel: {},
        initialDataModel: {},
        revision: 0,
      }
    } else if ('deleteSurface' in m) {
      s = null
    } else if (!s) {
      continue // updates for a surface that doesn't exist are ignored
    } else if ('updateComponents' in m) {
      const components = { ...s.components }
      for (const c of m.updateComponents.components) components[c.id] = c
      s = { ...s, components, revision: s.revision + 1 }
    } else if ('updateDataModel' in m) {
      const { path, value } = m.updateDataModel
      if (path === '' || path === '/') {
        const dm = structuredClone(value as Record<string, unknown>)
        s = { ...s, dataModel: dm, initialDataModel: structuredClone(dm) }
      } else {
        s = { ...s, dataModel: setAt(s.dataModel, path, value) }
      }
    }
  }
  return s
}
