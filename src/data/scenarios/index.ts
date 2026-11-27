import type { ScenarioId } from '@/types/run'
import type { Scenario } from '@/types/scenario'
import { dashboardScenario } from './dashboard'
import { buildGenericScenario } from './generic'
import { loginScenario } from './login'
import { checkoutScenario, forgotScenario, notificationsScenario, ordersScenario, productsScenario, signupScenario, teamScenario } from './more'
import { settingsScenario } from './settings'

/** Built-in patterns, in the order a typical product flow is assembled. */
export const BUILT_IN_SCENARIOS: Scenario[] = [
  loginScenario,
  signupScenario,
  forgotScenario,
  dashboardScenario,
  ordersScenario,
  productsScenario,
  checkoutScenario,
  teamScenario,
  notificationsScenario,
  settingsScenario,
]

const registry = new Map<ScenarioId, Scenario>(BUILT_IN_SCENARIOS.map((s) => [s.id, s]))

const scoreFor = (s: Scenario, text: string) => s.keywords.reduce((n, k) => (text.includes(k) ? n + k.split(' ').length : n), 0)

/** Best keyword match among built-in scenarios, or null. */
export function findScenario(prompt: string): Scenario | null {
  // A refined brief names its pattern up front ("Sign-in screen — …"); that header wins.
  const head = prompt.split('\n')[0].toLowerCase()
  const named = BUILT_IN_SCENARIOS.find((s) => head.startsWith(`${s.title.toLowerCase()} —`) || head.startsWith(`${s.title.toLowerCase()}:`))
  if (named) return named
  const text = prompt.toLowerCase()
  const ranked = BUILT_IN_SCENARIOS.map((s) => ({ s, n: scoreFor(s, text) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
  return ranked[0]?.s ?? null
}

/** Always resolves: keyword match → Figma defaults to sign-in → generic screen built from the prompt. */
export function resolveScenario(prompt: string, hasFigma: boolean): Scenario {
  const found = findScenario(prompt) ?? (hasFigma ? loginScenario : null)
  if (found) return found
  const generic = buildGenericScenario(prompt)
  registry.set(generic.id, generic)
  return generic
}

export function getScenario(id: ScenarioId): Scenario {
  const s = registry.get(id)
  if (!s) throw new Error(`Unknown scenario "${id}"`)
  return s
}

const NEW_SCREEN = /\b(add|create|new|another|build|generate|make|design)\b[\w\s'-]{0,48}\b(screen|page|view|step|form)\b/i

/** Should this prompt create a new screen rather than refine the active one? */
export const wantsNewScreen = (prompt: string) => Boolean(findScenario(prompt)) || NEW_SCREEN.test(prompt)
