/**
 * Static analysis of generated code — runs in the Deliver step, before export and before publish.
 * Pure string analysis (no execution): design-token violations, a11y smells, code hygiene,
 * plus project-level checks (flow links, sign-off, hard gates).
 */
import type { CodeAnalysis, Finding } from '@/types/export'
import type { ScreenState } from '@/types/project'
import type { GenFile } from '@/types/run'
import { languageForPath } from '@/utils/format'

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const PX = /(?<![\w-])(\d+(?:\.\d+)?)px\b/g
// Design-system plumbing that is *allowed* to hold raw values.
const TOKEN_FILE = /(tokens|aava-play|theme)\.(s?css|ts)$/
const STYLE_FILE = /\.(s?css|vue)$/
const CODE_FILE = /\.(ts|tsx|js|jsx|vue)$/
const MARKUP_FILE = /\.(html|tsx|jsx|vue)$/

export interface AnalyzeOptions {
  screens?: ScreenState[]
  routes?: { path: string; title: string }[]
}

export function analyzeFiles(files: GenFile[], opts: AnalyzeOptions = {}): CodeAnalysis {
  const findings: Finding[] = []
  const byLang = new Map<string, { files: number; loc: number }>()
  let loc = 0
  let bytes = 0

  for (const f of files) {
    const lines = f.content.split('\n')
    const fileLoc = lines.filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*|<!--)/.test(l)).length
    loc += fileLoc
    bytes += new TextEncoder().encode(f.content).length
    const lang = languageForPath(f.path)
    const agg = byLang.get(lang) ?? { files: 0, loc: 0 }
    byLang.set(lang, { files: agg.files + 1, loc: agg.loc + fileLoc })

    if (TOKEN_FILE.test(f.path) || /\.(json|md)$/.test(f.path) || f.path.includes('e2e/') || f.path.includes('verify/')) continue

    let todos = 0
    lines.forEach((line, i) => {
      const at = { file: f.path, line: i + 1 }
      const code = line.replace(/\/\/.*$/, '')
      if (STYLE_FILE.test(f.path) || MARKUP_FILE.test(f.path)) {
        for (const m of code.matchAll(HEX))
          findings.push({ severity: 'error', rule: 'DS-COLOR-01', message: `Raw colour ${m[0]} — use an AAVA colour token`, ...at })
      }
      if (STYLE_FILE.test(f.path)) {
        for (const m of code.matchAll(PX)) {
          const n = Number(m[1])
          if (n > 2 && n % 4 !== 0 && !/(max-|min-)?(width|height)|breakpoint|@media/.test(code))
            findings.push({ severity: 'warning', rule: 'DS-SPACE-01', message: `${m[0]} is off the 4px spacing scale`, ...at })
        }
      }
      if (CODE_FILE.test(f.path)) {
        if (/console\.log\(/.test(code)) findings.push({ severity: 'warning', rule: 'CODE-CONSOLE', message: 'console.log left in generated code', ...at })
        if (/:\s*any\b/.test(code)) findings.push({ severity: 'warning', rule: 'TS-ANY', message: 'Explicit `any` weakens type safety', ...at })
      }
      if (MARKUP_FILE.test(f.path) && /<img\b(?![^>]*\balt=)/.test(code)) findings.push({ severity: 'error', rule: 'A11Y-ALT', message: '<img> without alt text', ...at })
      if (/not part of the AAVA Play catalog/.test(line)) findings.push({ severity: 'error', rule: 'DS-COMP-03', message: 'Non-catalog component in output', ...at })
      if (/\bTODO\b/.test(line)) todos++
    })
    if (todos) findings.push({ severity: 'info', rule: 'CODE-TODO', message: `${todos} TODO marker(s) — wiring left for phase 2`, file: f.path })
  }

  // Project-level checks --------------------------------------------------------
  const screens = opts.screens ?? []
  const components = new Map<string, number>()
  let bindings = 0
  for (const s of screens) {
    const nodes = Object.values(s.surface?.components ?? {})
    for (const n of nodes) {
      if (['Column', 'Row', 'Grid'].includes(n.component)) continue
      components.set(n.component, (components.get(n.component) ?? 0) + 1)
      if (n.component === 'AavaTextField' && !String(n.label ?? '').trim())
        findings.push({ severity: 'error', rule: 'A11Y-LABEL', message: `${s.shared.title}: field #${n.id} has no accessible label` })
    }
    bindings += s.shared.bindings.length
    const q = s.shared.quality
    if (q && !q.hardGates.every((g) => g.passed)) findings.push({ severity: 'error', rule: 'GATE-HARD', message: `${s.shared.title}: hard quality gates failing (score ${q.score.toFixed(2)})` })
    else if (!s.signedOff) findings.push({ severity: 'warning', rule: 'FLOW-SIGNOFF', message: `${s.shared.title}: not signed off (HITL ②)` })
  }
  if (screens.length > 1) {
    const targets = new Set(screens.flatMap((s) => s.links.map((l) => l.targetId)))
    screens.forEach((s, i) => {
      if (i > 0 && !targets.has(s.id) && s.links.length === 0)
        findings.push({ severity: 'info', rule: 'FLOW-ORPHAN', message: `${s.shared.title} is not reachable from any other screen` })
    })
  }

  // Dependencies from package.json --------------------------------------------------
  const pkg = files.find((f) => f.path === 'package.json')
  const dependencies: CodeAnalysis['dependencies'] = []
  if (pkg) {
    try {
      const json = JSON.parse(pkg.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      for (const [name, version] of Object.entries(json.dependencies ?? {})) dependencies.push({ name, version, dev: false })
      for (const [name, version] of Object.entries(json.devDependencies ?? {})) dependencies.push({ name, version, dev: true })
    } catch {
      findings.push({ severity: 'error', rule: 'PKG-JSON', message: 'package.json is not valid JSON', file: 'package.json' })
    }
  }

  const severityOrder = { error: 0, warning: 1, info: 2 }
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  return {
    files: files.length,
    loc,
    bytes,
    byLanguage: [...byLang].map(([language, v]) => ({ language, ...v })).sort((a, b) => b.loc - a.loc),
    dependencies,
    routes: opts.routes ?? [],
    components: [...components].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    bindings,
    findings,
    counts: {
      error: findings.filter((f) => f.severity === 'error').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
  }
}

export const summarizeAnalysis = (a: CodeAnalysis) => `${a.files} files · ${a.loc} LOC · ${a.counts.error} error(s) · ${a.counts.warning} warning(s)`
