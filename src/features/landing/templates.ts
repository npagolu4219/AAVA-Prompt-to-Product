import { BUILT_IN_SCENARIOS } from '@/data/scenarios'
import { demoQuery } from '@/services/datasource/mockDatabase'
import type { SurfaceState } from '@/types/a2ui'
import type { Scenario } from '@/types/scenario'

export interface Template {
  id: string
  title: string
  prompt: string
  category: string
  surface: SurfaceState
}

const CATEGORY: Record<string, string> = {
  login: 'Auth',
  signup: 'Auth',
  'forgot-password': 'Auth',
  dashboard: 'Analytics',
  orders: 'Commerce',
  products: 'Commerce',
  checkout: 'Commerce',
  team: 'Admin',
  notifications: 'Admin',
  settings: 'Account',
}

/** Render-ready A2UI surface for a scenario, with its data needs filled from the demo DB. */
function previewSurface(sc: Scenario): SurfaceState {
  let comps = structuredClone(sc.components)
  for (const need of sc.dataNeeds) {
    const patch = need.apply(demoQuery(need.table, need.limit))
    comps = comps.map((c) => (patch[c.id] ? { ...c, ...patch[c.id] } : c))
  }
  return {
    surfaceId: `tpl-${sc.id}`,
    catalogId: 'aava-play@1',
    rootId: 'root',
    components: Object.fromEntries(comps.map((c) => [c.id, c])),
    dataModel: structuredClone(sc.dataModel),
    initialDataModel: structuredClone(sc.dataModel),
    revision: 1,
  }
}

const promptFor = (sc: Scenario) => {
  const s = sc.suggestion.replace(/^add (a |an )?/i, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

let cache: Template[] | null = null

export function getTemplates(): Template[] {
  cache ??= BUILT_IN_SCENARIOS.map((sc) => ({ id: sc.id, title: sc.title, prompt: promptFor(sc), category: CATEGORY[sc.id] ?? 'Screens', surface: previewSurface(sc) }))
  return cache
}
