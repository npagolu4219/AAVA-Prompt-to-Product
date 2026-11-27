/**
 * Scripted AAVA Process Flow — Sense → Match → Mind → Think → Act → Verify → Refine → Deliver.
 * Emits exactly the AG-UI events a real backend would, using scenario + demo-database data.
 *
 * Multi-screen: every full run builds ONE new screen (slug/position reserved by the client);
 * Deliver saves it into the project, links it into the user flow and analyses the code.
 */
import { getScenario, resolveScenario } from '@/data/scenarios'
import { analyzeFiles, summarizeAnalysis } from '@/services/analysis/analyzeCode'
import { generateAngularFiles } from '@/services/codegen/angular'
import { generateSpec } from '@/services/codegen/spec'
import { DEMO_TABLES, demoQuery } from '@/services/datasource/mockDatabase'
import { buildQuality, DECISION_COPY } from '@/services/quality/scoring'
import type { A2uiComponent, A2uiMessage } from '@/types/a2ui'
import type { JsonPatchOp } from '@/types/agui'
import type { CollectionBinding, GenFile, QualityReport, RunSource } from '@/types/run'
import type { QualityInput, Scenario, ScenarioPlan } from '@/types/scenario'
import { parseFigmaUrl, uid } from '@/utils/format'
import { createScriptHelpers, type ScriptContext, type ScriptHelpers } from './helpers'
import { groundOnResources } from './context'
import { applyRefinement } from './refinements'

const V = 'v0.9' as const
const SURFACE = 'canvas'
const LAYOUT = new Set(['Column', 'Row', 'Grid'])

class StopRun extends Error {}

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

const updateComponents = (components: A2uiComponent[]): A2uiMessage => ({ version: V, updateComponents: { surfaceId: SURFACE, components } })

/** Mind step: query the connected DB for every data need; returns patched components + bindings. */
async function importData(h: ScriptHelpers, ctx: ScriptContext, sc: Scenario, components: A2uiComponent[]) {
  const src = ctx.input.dataSource
  const bindings: CollectionBinding[] = []
  let next = components
  for (const need of sc.dataNeeds) {
    const rows = demoQuery(need.table, need.limit)
    await h.tool({
      name: src ? 'db.query' : 'seed.load',
      ms: 380,
      result: src ? `SELECT * FROM ${need.table} LIMIT ${need.limit} → ${rows.length} rows (${need.describe})` : `${rows.length} sample ${need.describe} (no database connected)`,
    })
    const patch = need.apply(rows)
    next = next.map((c) => (patch[c.id] ? { ...c, ...patch[c.id] } : c))
    if (src) for (const b of need.bindings) bindings.push({ ...b, table: need.table, source: src.name, rowCount: rows.length })
  }
  return { components: next, bindings }
}

// ---------------------------------------------------------------------------
// Full run — builds one new screen
// ---------------------------------------------------------------------------
export async function runFullFlow(ctx: ScriptContext) {
  const { input, emit } = ctx
  const h = createScriptHelpers(ctx)
  const sc = resolveScenario(input.prompt, Boolean(input.figma))
  const runId = uid('run')
  const slug = input.screen.slug
  const route = `/${slug}`
  const position = `${input.screen.index + 1}/${input.screen.max}`
  const figmaRef = input.figma ? parseFigmaUrl(input.figma.url) : null
  const source: RunSource = input.figma ? { kind: 'figma', label: sc.figma.frameName } : { kind: 'prompt', label: 'Prompt' }

  let plan: ScenarioPlan = sc.plan
  const planNotes: string[] = []
  let components: A2uiComponent[] = structuredClone(sc.components)
  let bindings: CollectionBinding[] = []
  let files: GenFile[] = []
  let version = 0
  const changelog: string[] = []
  const contextNames: string[] = []

  const spec = (quality: QualityReport | null) =>
    generateSpec({ scenario: sc, plan, planNotes, components, dataModel: sc.dataModel, version, source, quality, changelog, bindings, route, context: contextNames })
  const codegen = (defects: string[]) => generateAngularFiles({ slug, title: sc.title, components, dataModel: sc.dataModel, defects, version, bindings })

  emit({ type: 'RUN_STARTED', threadId: input.threadId, runId, mode: 'full' })
  emit({
    type: 'STATE_SNAPSHOT',
    snapshot: { scenarioId: sc.id, title: sc.title, version: 0, files: [], previousFiles: [], spec: '', quality: null, changelog: [], bindings: [] },
  })

  try {
    // ① Sense ---------------------------------------------------------------
    await h.step('Sense', async () => {
      await h.tool({ name: 'prompt.parse', ms: 520, result: `screenType=${sc.intent.screenType} · screen ${position}` })
      h.usage('Intent & Context', 1800 + input.prompt.length * 1.4 + input.resources.length * 220, 360)
      if (input.figma) {
        await h.tool({ name: 'figma.getNodes', ms: 760, result: `${sc.figma.nodeCount} nodes · “${sc.figma.frameName}”${figmaRef?.nodeId ? ` (${figmaRef.nodeId})` : ''}` })
        await h.tool({ name: 'figma.getImages', ms: 460, result: 'reference PNG @2x → Playwright baseline' })
        h.usage('Figma Ingest', 900 + sc.figma.nodeCount * 6, 240)
        await h.tool({ name: 'tokens.normalize', ms: 420, result: `${sc.figma.tokensMapped} values → AAVA tokens · ${sc.figma.tokensFlagged} flagged (ΔE)` })
      }
      const senseCtx = await groundOnResources(h, ctx, sc, 'sense')
      contextNames.push(...senseCtx.map((c) => c.name))
      if (input.dataSource && sc.dataNeeds.length) {
        await h.tool({ name: 'db.introspect', ms: 480, result: `${input.dataSource.name} · ${DEMO_TABLES.length} tables · needs ${sc.dataNeeds.map((d) => d.table).join(', ')}` })
      }
      const others = input.project.length ? ` It joins ${input.project.map((p) => `**${p.title}**`).join(', ')} as screen **${position}**.` : ''
      await h.say(
        `I read this as a **${sc.title.toLowerCase()}** (\`${sc.intent.screenType}\`).${others} ` +
          (input.figma
            ? `Pulled the **${sc.figma.frameName}** frame from Figma — ${sc.figma.tokensMapped} raw values snapped to AAVA tokens. Your access token stayed in the vault.`
            : '') +
          (senseCtx.length ? ` Grounding on ${senseCtx.map((c) => `**${c.name}**`).join(', ')}.` : '') +
          (sc.dataNeeds.length ? (input.dataSource ? ` Data will be imported from **${input.dataSource.name}**.` : ' No database connected — I’ll use bundled sample data.') : ''),
      )
      return `Intent JSON · ${sc.intent.screenType}${input.figma ? ' · frame tree' : ''}`
    })

    // ② Match ---------------------------------------------------------------
    await h.step('Match', async () => {
      await h.tool({ name: 'catalog.search', ms: 640, result: `top-${sc.shortlist.length} of 48 AAVA Play components` })
      h.usage('Component Matcher', 2400 + sc.shortlist.length * 120, 420)
      await h.say(`Matched **${sc.shortlist.length} AAVA Play components**: ${sc.shortlist.map((s) => `\`${s.name}\``).join(', ')}.`)
      return `${sc.shortlist.length} components shortlisted`
    })

    // ③ Mind ----------------------------------------------------------------
    await h.step('Mind', async () => {
      await h.tool({ name: 'kb.retrieve', ms: 560, result: sc.contextPack.sources.join(' · ') })
      const mindCtx = await groundOnResources(h, ctx, sc, 'mind')
      contextNames.push(...mindCtx.map((c) => c.name))
      const imported = await importData(h, ctx, sc, components)
      components = imported.components
      bindings = imported.bindings
      h.usage('Rules & Memory', sc.contextPack.tokens * 1.3 + input.resources.length * 600, 640)
      await h.tool({ name: 'context.budget', ms: 280, result: `${sc.contextPack.tokens.toLocaleString()} / ${sc.contextPack.budget.toLocaleString()} tokens` })
      return `Context pack · ${(sc.contextPack.tokens / 1000).toFixed(1)}k tokens${bindings.length ? ` · ${new Set(bindings.map((b) => b.table)).size} table(s) imported` : ''}`
    })

    // ④ Think + HITL ① -------------------------------------------------------
    await h.step('Think', async () => {
      await h.tool({ name: 'patterns.lookup', ms: 600, result: '2 matching layout patterns' })
      h.usage('Layout Planner', sc.contextPack.tokens + 1400, 950)
      await h.say(`**Plan:** ${plan.summary}`)
      if (input.options.autoApprovePlan) {
        await h.say('_HITL ① skipped — auto-approve is on for trusted templates._')
        return 'Plan auto-approved'
      }
      for (let attempt = 0; ; attempt++) {
        const d = await h.interrupt({ kind: 'plan', checkpoint: 1, title: `Approve layout plan for ${sc.title}?`, body: plan.summary, details: plan.items, options: ['approve', 'edit', 'reject'] })
        if (d.decision === 'approve') return 'Plan approved'
        if (d.decision === 'edit') {
          const note = d.note?.trim() || 'Reviewer adjusted the plan'
          planNotes.push(note)
          await h.say(`Folding in your note — “${note}”. Proceeding with the updated plan.`)
          return 'Plan approved with edits'
        }
        if (attempt >= 1) {
          await h.say('The plan was rejected twice, so I’ve stopped here. Rephrase the prompt or attach a Figma frame and I’ll start again.')
          throw new StopRun('Plan rejected')
        }
        plan = sc.altPlan
        h.usage('Layout Planner', sc.contextPack.tokens + 1900, 900)
        await h.say(`Understood. **Revised plan:** ${plan.summary}`)
      }
    })

    // ⑤ Act -----------------------------------------------------------------
    await h.step('Act', async () => {
      h.a2ui([
        { version: V, createSurface: { surfaceId: SURFACE, catalogId: 'aava-play@1' } },
        { version: V, updateDataModel: { surfaceId: SURFACE, path: '', value: sc.dataModel } },
      ])
      // Stream the surface node by node (root first) so the preview assembles visibly.
      for (const part of chunk(components, 1)) {
        h.a2ui([updateComponents(part)])
        await h.sleep(Math.max(70, 1400 / components.length))
      }
      h.usage('A2UI Composer', sc.contextPack.tokens + 1600, components.length * 95)
      const outside = components.filter((c) => !LAYOUT.has(c.component) && !c.component.startsWith('Aava'))
      await h.tool({ name: 'a2ui.validate', ms: 300, result: outside.length ? `schema OK · ⚠ ${outside.map((c) => c.component).join(', ')} not in catalog` : 'schema OK · 0 unknown components' })
      version = 1
      changelog.push('v1 — initial generation')
      files = codegen(sc.defects)
      await h.tool({ name: 'codegen.angular', ms: 520, result: `${files.length} files · prettier ✓${bindings.length ? ` · ${bindings.length} live collection(s)` : ''}` })
      h.usage('Angular Codegen', components.length * 40, 0)
      h.patch([
        { op: 'replace', path: '/files', value: files },
        { op: 'replace', path: '/spec', value: spec(null) },
        { op: 'replace', path: '/version', value: version },
        { op: 'replace', path: '/changelog', value: [...changelog] },
        { op: 'replace', path: '/bindings', value: bindings },
      ])
      await h.say(`Composed the A2UI surface (**${components.length} nodes**) and compiled **${files.length} Angular files** + spec. Running the four verifiers in parallel…`)
      return `A2UI · ${files.length} files · spec`
    })

    // ⑥ Verify --------------------------------------------------------------
    const verify = async (iteration: number, qi: QualityInput, history: number[], changedOnly: boolean) => {
      let report!: QualityReport
      await h.step('Verify', async () => {
        const k = changedOnly ? 0.55 : 1
        const n = (src: string) => qi.gaps.filter((g) => g.source === src).length
        await h.parallel([
          { name: 'critic.review', ms: 1700 * k, result: `${n('critic')} principle finding(s)` },
          { name: 'axe.scan', ms: 950 * k, result: `${qi.a11yCritical} critical · ${n('audit')} finding(s)` },
          { name: 'designLinter.run', ms: 520 * k, result: `${qi.lintErrors} error(s)` },
          { name: 'playwright.verify', ms: 1350 * k, result: `3 breakpoints · ${n('playwright')} visual gap(s)` },
        ])
        await h.tool({ name: 'merge.waitAll', ms: 220, result: `${qi.gaps.length} finding(s) after dedupe` })
        h.usage('Critic', (changedOnly ? 1800 : 3800) + components.length * 60, changedOnly ? 380 : 720)
        h.usage('Accessibility Audit', components.length * 30, 0)
        h.usage('Design Lint', components.length * 20, 0)
        h.usage('Playwright Verifier', components.length * 50, 0)
        report = buildQuality(qi, iteration, history)
        h.patch([
          { op: 'replace', path: '/quality', value: report },
          { op: 'replace', path: '/spec', value: spec(report) },
        ])
        return `Score ${report.score.toFixed(2)} · ${DECISION_COPY[report.decision].label}`
      })
      return report
    }

    // ⑦ Refine --------------------------------------------------------------
    const refine = async (note?: string) => {
      await h.step('Refine', async () => {
        const ops: JsonPatchOp[] = sc.fixes.flatMap((f) =>
          Object.entries(f.set).map(([k, value]) => ({ op: 'replace' as const, path: `/components/${components.findIndex((c) => c.id === f.id)}/${k}`, value })),
        )
        await h.tool({ name: 'fixer.jsonPatch', ms: 700, result: `${ops.length} A2UI op(s) + ${sc.defects.length} style fix(es)` })
        h.usage('Fixer', 2200 + sc.quality[0].gaps.length * 160, 300 + ops.length * 60)
        components = components.map((c) => {
          const fx = sc.fixes.find((f) => f.id === c.id)
          return fx ? { ...c, ...fx.set } : c
        })
        if (sc.fixes.length) h.a2ui([updateComponents(components.filter((c) => sc.fixes.some((f) => f.id === c.id)))])
        const previous = files
        version += 1
        changelog.push(`v${version} — auto-fix: ${[...sc.fixes.map((f) => f.reason), `${sc.defects.length} off-token style(s) replaced with tokens`].join('; ')}${note ? ` · reviewer: “${note}”` : ''}`)
        files = codegen([])
        await h.tool({ name: 'codegen.angular', ms: 420, result: 'recompiled changed regions only' })
        h.patch([
          { op: 'replace', path: '/previousFiles', value: previous },
          { op: 'replace', path: '/files', value: files },
          { op: 'replace', path: '/version', value: version },
          { op: 'replace', path: '/changelog', value: [...changelog] },
        ])
        await h.say(
          `Applied **${ops.length + sc.defects.length} targeted patch(es)** instead of regenerating the screen${ops.length ? `:\n\n\`\`\`json\n${JSON.stringify(ops.slice(0, 2), null, 2)}\n\`\`\`\n` : '. '}Re-verifying changed regions only.`,
          12,
        )
        return `JSON patch · v${version}`
      })
    }

    let quality = await verify(1, sc.quality[0], [], false)

    if (quality.decision === 'deliver') {
      h.skip('Refine', 'Score ≥ 0.90 and hard gates pass — nothing to fix')
    } else if (quality.decision === 'autofix') {
      await h.say(`Score **${quality.score.toFixed(2)}** sits in the auto-fix band (0.75–0.90) with ${quality.gaps.length} gap(s). Fixing automatically.`)
      await refine()
      quality = await verify(2, sc.quality[1], quality.history, true)
    } else {
      await h.say(`Score **${quality.score.toFixed(2)}** is below 0.75 with ${quality.hardGates.filter((g) => !g.passed).length} failing hard gate(s). Escalating to you (HITL ③).`)
      const d = await h.interrupt({
        kind: 'escalation',
        checkpoint: 3,
        title: `Score ${quality.score.toFixed(2)} — needs your decision`,
        body: 'Deterministic checks found hard-gate failures. I can apply targeted fixes, take your guidance, or keep this version as-is.',
        details: quality.gaps.map((g) => `${g.rule} · ${g.el} ${g.prop}: ${g.found} → ${g.expected}`),
        options: ['approve', 'edit', 'reject'],
        labels: { approve: 'Apply fixes', edit: 'Fix with guidance', reject: 'Keep as is' },
      })
      if (d.decision === 'reject') {
        h.skip('Refine', 'Reviewer kept v1 — gaps remain open')
        await h.say('Keeping v1 as-is. Open gaps are listed in the **Quality** tab and the spec.')
      } else {
        await refine(d.decision === 'edit' ? d.note?.trim() : undefined)
        quality = await verify(2, sc.quality[1], quality.history, true)
      }
    }

    // HITL ② final sign-off ----------------------------------------------------
    const allPass = quality.hardGates.every((g) => g.passed)
    await h.say(`Verification complete — **${quality.score.toFixed(2)}**, ${allPass ? 'all hard gates pass' : 'hard gates still failing'}. Ready for sign-off.`)
    const d = await h.interrupt({
      kind: 'final',
      checkpoint: 2,
      title: `Sign off ${sc.title} v${version}?`,
      body: `Score ${quality.score.toFixed(2)} · ${quality.lintErrors} lint errors · ${quality.a11yCritical} critical a11y issues. Your decision is recorded in the audit trail.`,
      details: quality.dimensions.map((x) => `${x.label}: ${x.score.toFixed(2)}`),
      options: ['approve', 'reject'],
      labels: { approve: 'Sign off', reject: 'Not yet' },
    })

    // ⑧ Deliver ---------------------------------------------------------------
    if (d.decision === 'approve') {
      const prev = input.project[input.project.length - 1]
      await h.step('Deliver', async () => {
        await h.tool({ name: 'project.save', ms: 320, result: `screen ${position} · route ${route} · v${version}` })
        if (prev?.primaryAction) {
          emit({ type: 'CUSTOM', name: 'screen_link', value: { fromScreenId: prev.id, action: prev.primaryAction, label: sc.title } })
          await h.tool({ name: 'flow.link', ms: 260, result: `${prev.title} · ${prev.primaryAction} → ${route}` })
        }
        const analysis = analyzeFiles(files)
        await h.tool({ name: 'analysis.run', ms: 420, result: summarizeAnalysis(analysis) })
        return `Screen ${position} saved${prev?.primaryAction ? ` · linked from ${prev.title}` : ''}`
      })
      const remaining = input.screen.max - input.screen.index - 1
      await h.say(
        `✅ **${sc.title}** is screen **${position}** at \`${route}\`${prev?.primaryAction ? `, reached from **${prev.title}** → \`${prev.primaryAction}\`` : ''}. ` +
          (remaining > 0
            ? `Add another screen (${remaining} left), refine this one in plain language, or **Export** / **Publish** the project.`
            : 'That’s the 10-screen limit — **Export** or **Publish** the project.'),
      )
    } else {
      h.skip('Deliver', 'Awaiting sign-off')
      await h.say('No problem — tell me what to change and I’ll run a targeted refinement.')
    }
  } catch (e) {
    if (!(e instanceof StopRun)) throw e
  }

  emit({ type: 'RUN_FINISHED', threadId: input.threadId, runId })
}

// ---------------------------------------------------------------------------
// Refinement run — patch the active screen, re-verify changed regions
// ---------------------------------------------------------------------------
export async function runRefineFlow(ctx: ScriptContext) {
  const { input, emit } = ctx
  const h = createScriptHelpers(ctx)
  const prev = input.context!
  const sc = getScenario(prev.scenarioId)
  const runId = uid('run')
  const slug = input.screen.slug
  let version = prev.version

  emit({ type: 'RUN_STARTED', threadId: input.threadId, runId, mode: 'refine' })

  await h.step('Sense', async () => {
    await h.tool({ name: 'prompt.parse', ms: 380, result: `refinement of ${sc.title} v${version}` })
    h.usage('Intent & Context', 1400 + input.prompt.length * 1.4, 220)
    return 'Refinement intent'
  })
  h.skip('Match', `Reusing shortlist from v${version}`)
  h.skip('Mind', 'Context pack cached (prompt-cache hit)')
  h.skip('Think', 'Approved plan unchanged')

  const result = applyRefinement(prev.components, input.prompt)
  let changelog = prev.changelog
  let files = prev.files

  await h.step('Act', async () => {
    await h.tool({ name: 'fixer.jsonPatch', ms: 520, result: `${result.ops.length} op(s)` })
    h.usage('Fixer', 1800 + prev.components.length * 45, 180 + result.ops.length * 70)
    if (!result.changed.length) return 'No mappable change'
    h.a2ui([updateComponents(result.changed)])
    version += 1
    changelog = [...changelog, `v${version} — refinement: ${result.notes.join('; ')}`]
    files = generateAngularFiles({ slug, title: sc.title, components: result.components, dataModel: prev.dataModel, version, bindings: prev.bindings })
    await h.tool({ name: 'codegen.angular', ms: 360, result: 'recompiled changed regions only' })
    h.patch([
      { op: 'replace', path: '/previousFiles', value: prev.files },
      { op: 'replace', path: '/files', value: files },
      { op: 'replace', path: '/version', value: version },
      { op: 'replace', path: '/changelog', value: changelog },
    ])
    return `Patched ${result.changed.length} component(s) · v${version}`
  })

  if (!result.changed.length) {
    h.skip('Verify', 'Nothing changed')
    h.skip('Refine', 'Nothing changed')
    h.skip('Deliver', 'Nothing changed')
    await h.say(
      'I couldn’t map that to a change on this screen. Try:\n\n- _Change the heading to "Welcome back"_\n- _Make all buttons full width_\n- _Make the main button secondary_\n- _Remove the SSO button_\n\nOr start a new screen, e.g. _Add an orders list screen_.',
    )
    emit({ type: 'RUN_FINISHED', threadId: input.threadId, runId })
    return
  }

  await h.step('Verify', async () => {
    await h.parallel([
      { name: 'designLinter.run', ms: 300, result: '0 error(s) · changed regions' },
      { name: 'playwright.verify', ms: 700, result: '3 breakpoints · 0 gap(s) · changed regions' },
    ])
    const base = prev.quality
    if (!base) return 'Changed regions verified'
    const report: QualityReport = { ...base, iteration: base.iteration + 1, history: [...base.history, base.score] }
    h.patch([
      { op: 'replace', path: '/quality', value: report },
      {
        op: 'replace',
        path: '/spec',
        value: generateSpec({ scenario: sc, plan: sc.plan, planNotes: [], components: result.components, dataModel: prev.dataModel, version, source: { kind: 'prompt', label: 'Prompt' }, quality: report, changelog, bindings: prev.bindings, route: `/${slug}` }),
      },
    ])
    return `Score ${report.score.toFixed(2)} held`
  })
  h.skip('Refine', 'Score above threshold')

  await h.step('Deliver', async () => {
    await h.tool({ name: 'project.save', ms: 240, result: `${sc.title} → v${version}` })
    await h.tool({ name: 'analysis.run', ms: 320, result: summarizeAnalysis(analyzeFiles(files)) })
    return `v${version} saved`
  })

  await h.say(`Done — **${sc.title} v${version}**:\n\n${result.notes.map((n) => `- ${n}`).join('\n')}\n\nOnly ${result.changed.length} component(s) were patched and re-verified; check the **Diff** in the Code tab.`)
  emit({ type: 'RUN_FINISHED', threadId: input.threadId, runId })
}
