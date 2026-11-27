export interface RunHistoryItem {
  id: string
  title: string
  prompt: string
  source: 'prompt' | 'figma'
  score: number
  status: 'delivered' | 'escalated' | 'cancelled'
  iterations: number
  tokens: number
  durationSec: number
  at: number
  author: string
}

const H = 3600_000
const now = Date.now()

/** Dummy history so the drawer has realistic content on first load. */
export const RUN_HISTORY: RunHistoryItem[] = [
  { id: 'run_8f21', title: 'Sign-in screen', prompt: 'Login screen from Figma, AAVA theme, SSO option', source: 'figma', score: 0.93, status: 'delivered', iterations: 2, tokens: 18420, durationSec: 94, at: now - 2 * H, author: 'Design Systems' },
  { id: 'run_8e90', title: 'Revenue dashboard', prompt: 'Revenue analytics dashboard with KPIs, weekly chart and recent orders', source: 'prompt', score: 0.95, status: 'delivered', iterations: 2, tokens: 22110, durationSec: 121, at: now - 5 * H, author: 'Commerce squad' },
  { id: 'run_8d17', title: 'Profile settings', prompt: 'Profile settings form with notification preferences', source: 'prompt', score: 0.71, status: 'escalated', iterations: 1, tokens: 15890, durationSec: 77, at: now - 26 * H, author: 'Platform' },
  { id: 'run_8c02', title: 'Order details', prompt: 'Order details page with timeline and refund action', source: 'figma', score: 0.91, status: 'delivered', iterations: 3, tokens: 26740, durationSec: 158, at: now - 50 * H, author: 'Commerce squad' },
  { id: 'run_8b44', title: 'Onboarding wizard', prompt: 'Three step onboarding wizard for workspace setup', source: 'prompt', score: 0.88, status: 'cancelled', iterations: 1, tokens: 9120, durationSec: 41, at: now - 76 * H, author: 'Growth' },
  { id: 'run_8a10', title: 'Approval inbox', prompt: 'Approval inbox with filters, bulk approve and detail drawer', source: 'prompt', score: 0.94, status: 'delivered', iterations: 2, tokens: 20330, durationSec: 109, at: now - 120 * H, author: 'Platform' },
]
