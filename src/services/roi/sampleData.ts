/**
 * Deterministic sample ledger so the ROI dashboard is meaningful before real usage accumulates.
 * Rows are flagged `sample: true` and can be hidden with one toggle; they are never saved.
 */
import { AGENT_TIERS } from '@/config/roi'
import type { Complexity, RunOutcome, RunRecord, UsageEntry } from '@/types/roi'
import type { StepName } from '@/types/run'

const DAY = 86_400_000

/** mulberry32 — tiny seeded PRNG so the sample is identical on every load. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SCREENS: { id: string; title: string; cx: Complexity; components: number; loc: number }[] = [
  { id: 'login', title: 'Sign-in screen', cx: 'simple', components: 14, loc: 160 },
  { id: 'signup', title: 'Create account', cx: 'simple', components: 16, loc: 190 },
  { id: 'forgot-password', title: 'Reset password', cx: 'simple', components: 8, loc: 110 },
  { id: 'dashboard', title: 'Revenue dashboard', cx: 'complex', components: 19, loc: 360 },
  { id: 'orders', title: 'Orders', cx: 'medium', components: 11, loc: 240 },
  { id: 'products', title: 'Product catalog', cx: 'medium', components: 9, loc: 210 },
  { id: 'checkout', title: 'Checkout', cx: 'complex', components: 21, loc: 330 },
  { id: 'team', title: 'Team members', cx: 'medium', components: 14, loc: 260 },
  { id: 'notifications', title: 'Notifications', cx: 'medium', components: 10, loc: 200 },
  { id: 'settings', title: 'Profile settings', cx: 'medium', components: 25, loc: 300 },
]

const PROJECTS = [
  { name: 'Customer Portal', screens: ['login', 'signup', 'forgot-password', 'dashboard', 'settings', 'notifications'] },
  { name: 'Commerce Admin', screens: ['dashboard', 'orders', 'products', 'team'] },
  { name: 'Mobile Checkout', screens: ['products', 'checkout', 'orders'] },
  { name: 'Partner Onboarding', screens: ['signup', 'settings', 'team', 'notifications'] },
  { name: 'Ops Console', screens: ['login', 'dashboard', 'orders', 'team', 'notifications'] },
]

function usageFor(r: () => number, components: number, refine: boolean, verifyLoops: number, cacheShare: number): UsageEntry[] {
  const ctx = 2900 + components * 40
  const plan: [string, StepName, number, number][] = refine
    ? [
        ['Intent & Context', 'Sense', 1500, 220],
        ['Fixer', 'Act', 1800 + components * 45, 260],
      ]
    : [
        ['Intent & Context', 'Sense', 1900, 360],
        ['Component Matcher', 'Match', 2900, 420],
        ['Rules & Memory', 'Mind', ctx * 1.3, 640],
        ['Layout Planner', 'Think', ctx + 1400, 950],
        ['A2UI Composer', 'Act', ctx + 1600, components * 95],
        ['Angular Codegen', 'Act', components * 40, 0],
        ...Array.from({ length: verifyLoops }, (_, i): [string, StepName, number, number][] => [
          ['Critic', 'Verify', (i ? 1800 : 3800) + components * 60, i ? 380 : 720],
          ['Accessibility Audit', 'Verify', components * 30, 0],
          ['Design Lint', 'Verify', components * 20, 0],
          ['Playwright Verifier', 'Verify', components * 50, 0],
        ]).flat(),
        ...(verifyLoops > 1 ? [['Fixer', 'Refine', 2600, 420] as [string, StepName, number, number]] : []),
      ]
  return plan.map(([agent, step, inp, out]) => {
    const tier = AGENT_TIERS[agent] ?? 'small'
    const llm = tier !== 'none'
    const j = 0.85 + r() * 0.3
    const input = llm ? Math.round(inp * j) : 0
    return { agent, step, tier, inputTokens: input, outputTokens: llm ? Math.round(out * j) : 0, cachedTokens: llm ? Math.round(input * cacheShare) : 0, latencyMs: llm ? Math.round(400 + out * 14 * j) : Math.round(120 + inp / 40) }
  })
}

let cache: { key: number; rows: RunRecord[] } | null = null

/** ~90 runs over the last 60 days across 5 projects, anchored to "now" (day granularity). */
export function sampleLedger(now = Date.now()): RunRecord[] {
  const key = Math.floor(now / DAY)
  if (cache?.key === key) return cache.rows
  const r = rng(20260924)
  const rows: RunRecord[] = []
  PROJECTS.forEach((p, pi) => {
    const projectStart = now - (44 - pi * 8) * DAY
    let t = projectStart
    p.screens.forEach((sid, si) => {
      const sc = SCREENS.find((s) => s.id === sid)!
      t += (1 + r() * 4) * DAY * 0.8
      if (t > now - DAY / 2) t = now - r() * DAY
      const roll = r()
      const outcome: RunOutcome = roll < 0.82 ? 'delivered' : roll < 0.9 ? 'draft' : roll < 0.95 ? 'escalated' : 'cancelled'
      const loops = outcome === 'cancelled' ? 0 : r() < 0.7 ? 2 : 1
      const firstPass = 0.74 + r() * 0.18
      const final = outcome === 'cancelled' ? null : Math.min(0.97, firstPass + (loops > 1 ? 0.08 + r() * 0.05 : 0.02))
      const duration = (outcome === 'cancelled' ? 20 : 55 + sc.components * 3 + loops * 18) * 1000 * (0.8 + r() * 0.4)
      const decisions = outcome === 'cancelled' ? 1 : outcome === 'escalated' ? 3 : 2
      const wait = decisions * (90 + r() * 360) * 1000
      const threadId = `sample-${pi}`
      rows.push({
        id: `sample-${pi}-${si}`,
        threadId,
        project: p.name,
        screenId: `sample-${pi}-${sid}`,
        screenTitle: sc.title,
        scenarioId: sid,
        mode: 'full',
        startedAt: t,
        finishedAt: t + duration + wait,
        durationMs: duration,
        outcome,
        usage: outcome === 'cancelled' ? usageFor(r, sc.components, false, 0, 0.2).slice(0, 3) : usageFor(r, sc.components, false, loops, si === 0 ? 0.2 : 0.55),
        hitlDecisions: decisions,
        hitlWaitMs: wait,
        components: sc.components,
        complexity: sc.cx,
        filesGenerated: outcome === 'cancelled' ? 0 : 4,
        loc: outcome === 'cancelled' ? 0 : Math.round(sc.loc * (0.9 + r() * 0.2)),
        qualityScore: final,
        firstPassScore: outcome === 'cancelled' ? null : firstPass,
        iterations: loops,
        gapsAutoFixed: loops > 1 ? 1 + Math.floor(r() * 4) : 0,
        gapsRemaining: outcome === 'escalated' ? 2 : outcome === 'draft' ? 1 : 0,
        hardGatesPassed: outcome === 'delivered' || outcome === 'draft',
        sample: true,
      })
      // Some screens get follow-up refinements.
      const refines = r() < 0.55 ? 1 + Math.floor(r() * 2) : 0
      for (let k = 0; k < refines && outcome !== 'cancelled'; k++) {
        const rt = Math.min(now - 60_000, t + (0.1 + r() * 0.8) * DAY)
        const rd = (14 + r() * 12) * 1000
        rows.push({
          id: `sample-${pi}-${si}-r${k}`,
          threadId,
          project: p.name,
          screenId: `sample-${pi}-${sid}`,
          screenTitle: sc.title,
          scenarioId: sid,
          mode: 'refine',
          startedAt: rt,
          finishedAt: rt + rd,
          durationMs: rd,
          outcome: 'delivered',
          usage: usageFor(r, sc.components, true, 0, 0.55),
          hitlDecisions: 0,
          hitlWaitMs: 0,
          components: sc.components,
          complexity: sc.cx,
          filesGenerated: 4,
          loc: Math.round(sc.loc * 0.15),
          qualityScore: final,
          firstPassScore: final,
          iterations: 1,
          gapsAutoFixed: 0,
          gapsRemaining: 0,
          hardGatesPassed: true,
          sample: true,
        })
      }
    })
  })
  rows.sort((a, b) => a.startedAt - b.startedAt)
  cache = { key, rows }
  return rows
}
