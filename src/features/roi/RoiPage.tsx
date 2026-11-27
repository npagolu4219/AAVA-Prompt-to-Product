import { useMemo, useState } from 'react'
import { useLedger } from '@/app/providers/LedgerProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon, type IconName } from '@/components/ui/Icon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { useLocalStorage } from '@/hooks'
import { ROI_STORAGE } from '@/config/roi'
import { PageHeader } from '@/features/nav/PageHeader'
import { downloadText } from '@/services/export/zipExport'
import { computeRoi, projectsCsv, ROLE_LABEL, type ProjectRow } from '@/services/roi/engine'
import { sampleLedger } from '@/services/roi/sampleData'
import { cx } from '@/utils/format'
import { AssumptionsDrawer } from './AssumptionsDrawer'
import { CompareMetric, DailyColumns, GroupedColumns, Legend, LinePair, RankedBars, ShareBar, ValueBridge } from './charts'
import styles from './Roi.module.scss'

type Period = 7 | 30 | 90 | 0
const DAY = 86_400_000

const money = (n: number, digits?: number) => {
  const a = Math.abs(n)
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : a >= 100 ? Math.round(a).toLocaleString('en-US') : a.toFixed(digits ?? (a < 1 ? 3 : 2))
  return `${n < 0 ? '−' : ''}$${s}`
}
const hours = (n: number) => `${n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1)} h`
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
const pct = (n: number | null, d = 0) => (n == null ? '—' : `${(n * 100).toFixed(d)}%`)
const durationH = (h: number) => (h >= 16 ? `${(h / 8).toFixed(1)} d` : h >= 1 ? `${h.toFixed(1)} h` : `${Math.round(h * 60)} min`)

type SortKey = 'net' | 'hoursSaved' | 'aiCost' | 'screensBuilt' | 'roi' | 'avgQuality'

/**
 * ROI dashboard: business value, engineering hours saved, AI usage & cost, baseline vs actual
 * and project-wise metrics — all computed by the value engine from the run ledger.
 */
export function RoiPage() {
  const { records, assumptions } = useLedger()
  const [prefs, setPrefs] = useLocalStorage<{ period: Period; sample: boolean; project: string }>(ROI_STORAGE.prefs, { period: 30, sample: true, project: 'all' })
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('net')
  // Fixed "now" per mount keeps period windows stable while the page is open.
  const [now] = useState(() => Date.now())

  const live = records.filter((r) => !r.sample)
  const all = useMemo(() => (prefs.sample ? [...sampleLedger(now), ...records] : records), [prefs.sample, records, now])
  const from = prefs.period ? now - prefs.period * DAY : Math.min(now - DAY, ...all.map((r) => r.startedAt))
  const projectNames = useMemo(() => [...new Set(all.map((r) => r.project))].sort(), [all])
  const project = prefs.project !== 'all' && !projectNames.includes(prefs.project) ? 'all' : prefs.project
  const report = useMemo(() => computeRoi(all, assumptions, { from, to: now, project }), [all, assumptions, from, now, project])
  const t = report.totals

  const sortedProjects = useMemo(() => [...report.projects].sort((x, y) => ((y[sort] ?? -Infinity) as number) - ((x[sort] ?? -Infinity) as number)), [report.projects, sort])

  const setP = (patch: Partial<typeof prefs>) => setPrefs({ ...prefs, ...patch })

  const header = (
    <PageHeader
      icon="gauge"
      title="ROI & business value"
      subtitle="Measured from every agent run — tokens, HITL time, quality and output — against an editable manual baseline."
      actions={
        <>
          <Button icon="sliders" onClick={() => setAssumptionsOpen(true)}>
            Assumptions
          </Button>
          <Button icon="download" onClick={() => downloadText(projectsCsv(sortedProjects), `aava-roi-projects-${new Date(now).toISOString().slice(0, 10)}.csv`, 'text/csv')} disabled={!report.projects.length}>
            CSV
          </Button>
        </>
      }
    />
  )

  const filters = (
    <div className={styles.filters}>
      <SegmentedControl<Period>
        label="Period"
        size="sm"
        value={prefs.period}
        onChange={(period) => setP({ period })}
        options={[
          { value: 7, label: '7 days' },
          { value: 30, label: '30 days' },
          { value: 90, label: '90 days' },
          { value: 0, label: 'All' },
        ]}
      />
      <label className={styles.select}>
        <Icon name="layers" size={14} />
        <span className="sr-only">Project</span>
        <select value={project} onChange={(e) => setP({ project: e.target.value })}>
          <option value="all">All projects ({projectNames.length})</option>
          {projectNames.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <div className={styles.sampleToggle}>
        <Switch label="Include sample data" checked={prefs.sample} onChange={(sample) => setP({ sample })} />
      </div>
      <span className={styles.liveCount}>
        <span className={cx(styles.liveDot, live.length > 0 && styles.liveOn)} /> {live.length} live run{live.length === 1 ? '' : 's'} recorded
      </span>
    </div>
  )

  if (!t.runs) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.body}>
          {filters}
          <EmptyState icon="gauge" title="No runs in this period" description={prefs.sample ? 'Widen the period or pick another project.' : 'Generate a few screens in the Studio — every run is recorded here — or turn on sample data to explore the dashboard.'}>
            {!prefs.sample && (
              <Button icon="sparkles" onClick={() => setP({ sample: true })}>
                Show sample data
              </Button>
            )}
          </EmptyState>
        </div>
        <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} />
      </div>
    )
  }

  const perScreen = (n: number) => (t.screensBuilt ? n / t.screensBuilt : 0)
  const dailyBudget = assumptions.monthlyAiBudget / 30
  const peakDay = Math.max(0, ...report.daily.map((d) => d.aiCost))
  // Only draw the budget line when it doesn't flatten the bars into invisibility.
  const budgetOnScale = dailyBudget <= peakDay * 4
  const budgetTone = report.budget.used >= 1 ? 'danger' : report.budget.used >= 0.8 ? 'warning' : 'success'

  return (
    <div className={styles.page}>
      {header}
      <div className={styles.body}>
        {filters}
        {prefs.sample && (
          <p className={styles.sampleNote}>
            <Icon name="info" size={14} /> Includes <b>sample data</b> for {projectNames.filter((p) => report.projects.find((x) => x.project === p)?.sample).length} demo projects. Turn it off to see only your recorded runs.
          </p>
        )}

        {/* ---------------- KPIs ---------------- */}
        <section className={styles.kpis} aria-label="Key results">
          <Kpi icon="trendingUp" label="Net business value" value={money(t.net)} tone={t.net >= 0 ? 'good' : 'bad'} sub={`${money(t.value)} value − ${money(t.investment)} investment`} />
          <Kpi icon="gauge" label="ROI" value={t.roi == null ? '—' : `${Math.round(t.roi * 100).toLocaleString()}%`} tone={t.roi != null && t.roi >= 0 ? 'good' : 'bad'} sub={t.paybackDays != null ? `Pays back in ${t.paybackDays < 1 ? 'under a day' : `${t.paybackDays.toFixed(1)} days`} of usage` : 'No value yet'} />
          <Kpi icon="clock" label="Engineering hours saved" value={hours(t.hoursSaved)} sub={`${(t.hoursSaved / 40).toFixed(1)} FTE-weeks · ${pct(t.baselineHours ? t.hoursSaved / t.baselineHours : null)} of baseline effort`} />
          <Kpi icon="bolt" label="AI spend" value={money(t.aiCost)} sub={`${pct(report.budget.used)} of ${money(report.budget.limit, 0)} budget`} badge={{ tone: budgetTone, text: budgetTone === 'success' ? 'On budget' : budgetTone === 'warning' ? 'Near limit' : 'Over budget' }} />
          <Kpi icon="layout" label="Screens delivered" value={String(t.screensBuilt)} sub={`${t.delivered} signed off · ${t.refines} refinements · ${t.failed} stopped`} />
          <Kpi icon="activity" label="AI cost per screen" value={money(perScreen(t.aiCost))} sub={`vs ${money(perScreen(t.laborBaseline), 0)} manual labour per screen`} />
        </section>

        {/* ---------------- Value ---------------- */}
        <div className={styles.row2}>
          <Card title="Business value bridge" subtitle="How value builds up to net, for the selected period.">
            <ValueBridge
              steps={[
                { label: 'Labour saved', v: t.laborSaved },
                { label: 'Defects avoided', v: t.defectsValue },
                { label: 'AI spend', v: -t.aiCost },
                { label: 'Platform & build', v: -t.platformCost },
                { label: 'Net value', v: t.net, total: true },
              ]}
              format={(n) => money(n, Math.abs(n) < 10 ? 2 : 0)}
            />
            <Legend
              items={[
                { label: 'Gain', color: 'var(--viz-pos)' },
                { label: 'Cost', color: 'var(--viz-neg)' },
              ]}
            />
          </Card>
          <Card title="Cumulative value vs investment" subtitle="Value overtakes investment at the payback point.">
            <Legend
              items={[
                { label: 'Cumulative value', color: 'var(--viz-1)' },
                { label: 'Cumulative investment (AI + platform)', color: 'var(--viz-2)', dashed: true },
              ]}
            />
            <LinePair
              points={report.daily.map((d) => ({ x: d.day, values: [d.cumValue, d.cumInvestment] }))}
              series={[
                { label: 'Value', color: 'var(--viz-1)' },
                { label: 'Investment', color: 'var(--viz-2)', dashed: true },
              ]}
              format={(n) => money(n, 0)}
            />
          </Card>
        </div>

        {/* ---------------- Baseline vs actual ---------------- */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <div>
              <h2>Baseline vs actual</h2>
              <p>Per screen built. Baseline = manual design → dev → QA and full-code LLM regeneration; actual = measured runs.</p>
            </div>
            <Legend
              items={[
                { label: 'Baseline', color: 'var(--viz-2)' },
                { label: 'Actual', color: 'var(--viz-1)' },
              ]}
            />
          </header>
          <div className={styles.compareGrid}>
            <CompareMetric title="Engineering hours / screen" baseline={perScreen(t.baselineHours)} actual={perScreen(t.actualHours)} format={hours} better="lower" note="Actual includes measured HITL review time + remaining manual effort." />
            <CompareMetric title="Delivery cost / screen" baseline={perScreen(t.laborBaseline)} actual={perScreen(t.laborActual + t.aiCost + t.platformCost)} format={(n) => money(n, 0)} better="lower" note="Actual = remaining labour + AI spend + platform share." />
            <CompareMetric title="Lead time / screen" baseline={perScreen(t.leadBaselineH)} actual={perScreen(t.leadActualH)} format={durationH} better="lower" note={`Working days of ${assumptions.hoursPerDay} h; actual = run + review + remaining work.`} />
            <CompareMetric title="LLM tokens / screen" baseline={perScreen(t.baselineTokens)} actual={perScreen(t.builtTokens)} format={tokens} better="lower" note={`Baseline: full-code regeneration × ${assumptions.regenLoops} loops (deck hypothesis: 40–60% fewer).`} />
            <CompareMetric
              title="DS-compliant at first review"
              baseline={assumptions.baselineFirstPass}
              actual={t.reviewReadyRate ?? 0}
              format={(n) => pct(n)}
              better="higher"
              note={`Screens ≥ 0.90 with hard gates passing when a human first sees them. Raw agent first pass, before auto-fix: ${pct(t.firstPassRate)}.`}
            />
            <CompareMetric
              title="Defects reaching review / screen"
              baseline={perScreen(t.defectsValue / Math.max(1, assumptions.defectCost) + t.gapsRemaining)}
              actual={perScreen(t.gapsRemaining)}
              format={(n) => n.toFixed(1)}
              better="lower"
              note="Baseline = every gap found by verification; actual = gaps still open after auto-fix."
            />
          </div>
        </section>

        {/* ---------------- Hours ---------------- */}
        <div className={styles.row2}>
          <Card title="Engineering hours by role" subtitle={`${hours(t.baselineHours)} baseline → ${hours(t.actualHours)} actual`}>
            <Legend
              items={[
                { label: 'Baseline', color: 'var(--viz-2)' },
                { label: 'Actual', color: 'var(--viz-1)' },
              ]}
            />
            <GroupedColumns data={report.roles.map((r) => ({ label: ROLE_LABEL[r.role], baseline: r.baseline, actual: r.actual }))} format={(n) => `${Math.round(n)}h`} />
          </Card>
          <Card title="Where the hours came from" subtitle="Hours saved, by screen complexity and run type.">
            <dl className={styles.facts}>
              <div>
                <dt>Simple screens</dt>
                <dd>{report.complexity.simple}</dd>
              </div>
              <div>
                <dt>Medium screens</dt>
                <dd>{report.complexity.medium}</dd>
              </div>
              <div>
                <dt>Complex screens</dt>
                <dd>{report.complexity.complex}</dd>
              </div>
              <div>
                <dt>Refinement runs</dt>
                <dd>{t.refines}</dd>
              </div>
              <div>
                <dt>HITL decisions</dt>
                <dd>{t.hitlDecisions}</dd>
              </div>
              <div>
                <dt>Human review time</dt>
                <dd>{durationH(t.hitlMinutes / 60)}</dd>
              </div>
              <div>
                <dt>Avg. quality score</dt>
                <dd>{t.avgQuality == null ? '—' : t.avgQuality.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Value per hour saved</dt>
                <dd>{t.hoursSaved > 0 ? money(t.value / t.hoursSaved, 0) : '—'}</dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* ---------------- AI usage & cost ---------------- */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <div>
              <h2>AI usage & cost</h2>
              <p>Reported by every agent over AG-UI (CUSTOM “usage”). Deterministic agents (codegen, lint, a11y, Playwright) cost no tokens.</p>
            </div>
          </header>
          <div className={styles.miniKpis}>
            <MiniKpi label="Tokens" value={tokens(t.tokens.input + t.tokens.output)} sub={`${tokens(t.tokens.input)} in · ${tokens(t.tokens.output)} out`} />
            <MiniKpi label="Prompt-cache hit rate" value={pct(t.tokens.input ? t.tokens.cached / t.tokens.input : null)} sub={`${money(t.cacheSavings)} saved by caching`} />
            <MiniKpi label="Token reduction vs full-code" value={pct(t.tokenReduction)} sub={`${tokens(t.builtTokens)} vs ${tokens(t.baselineTokens)}`} />
            <MiniKpi label="Avg. cost per run" value={money(t.runs ? t.aiCost / t.runs : 0)} sub={`${t.runs} runs`} />
          </div>
          <div className={styles.row2}>
            <Card
              title="Daily AI spend"
              subtitle={
                budgetOnScale
                  ? `Dashed line: daily budget (${money(dailyBudget)}/day)`
                  : `Daily budget ${money(dailyBudget)} is off-scale — peak day used ${pct(peakDay / dailyBudget, 1)} of it.`
              }
            >
              <DailyColumns data={report.daily.map((d) => ({ x: d.day, v: d.aiCost }))} format={(n) => money(n, n < 1 ? 2 : 0)} reference={budgetOnScale ? dailyBudget : undefined} referenceLabel="Daily budget" />
            </Card>
            <Card title="Spend by model tier" subtitle="Large models are reserved for planning and critique.">
              <ShareBar
                parts={report.tiers.map((x, i) => ({ label: `${x.tier[0].toUpperCase()}${x.tier.slice(1)} · ${tokens(x.tokens)} tok`, v: x.cost, color: `var(--viz-${i + 1})` }))}
                format={(n) => money(n)}
              />
            </Card>
          </div>
          <Card title="Spend by agent" subtitle="Calls, tokens and average latency per agent in the AAVA flow.">
            <RankedBars
              rows={report.agents.map((x) => ({ label: x.agent, v: x.cost, sub: x.tier === 'none' ? 'deterministic' : `${x.tier} model` }))}
              format={(n) => money(n)}
              meta={(i) => {
                const x = report.agents[i]
                return (
                  <>
                    {x.calls} calls · {tokens(x.tokens)} tok · {(x.avgLatencyMs / 1000).toFixed(1)}s
                  </>
                )
              }}
            />
          </Card>
        </section>

        {/* ---------------- Projects ---------------- */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <div>
              <h2>Project-wise metrics</h2>
              <p>Each conversation is a project. Platform cost is shared in proportion to screens built. Click a project to focus the dashboard.</p>
            </div>
            <label className={styles.select}>
              <span>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="net">Net value</option>
                <option value="hoursSaved">Hours saved</option>
                <option value="roi">ROI</option>
                <option value="aiCost">AI cost</option>
                <option value="screensBuilt">Screens</option>
                <option value="avgQuality">Quality</option>
              </select>
            </label>
          </header>
          <ProjectsTable rows={sortedProjects} active={project} onPick={(p) => setP({ project: p === project ? 'all' : p })} />
        </section>

        <details className={styles.method}>
          <summary>
            <Icon name="info" size={14} /> How the numbers are calculated
          </summary>
          <ul>
            <li>
              <b>Labour saved</b> = Σ per role (baseline hours − actual hours) × rate. Baseline hours come from screen complexity (A2UI component count); actual hours = measured HITL review time + remaining effort after generation.
            </li>
            <li>
              <b>Defects avoided</b> = gaps auto-fixed before review × cost of a late defect.
            </li>
            <li>
              <b>AI spend</b> = Σ agent tokens × tier price, with cached input billed at the cached rate. <b>Platform & build</b> = monthly platform cost + one-time implementation ÷ amortisation months, pro-rated to the period.
            </li>
            <li>
              <b>Net value</b> = value − (AI spend + platform). <b>ROI</b> = net ÷ investment. <b>Payback</b> = investment ÷ average daily value.
            </li>
            <li>
              <b>Token baseline</b> = per loop: full design context (no retrieval) + previous code + regenerated code, × regeneration loops — the “full-code regeneration” alternative from the deck. <b>DS-compliant at first review</b> compares what a human first sees: hand-built screens vs auto-fixed generated screens.
            </li>
            <li>Every non-measured input is an assumption you can edit. Treat results as pilot hypotheses until calibrated against timesheets.</li>
          </ul>
        </details>
      </div>
      <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} />
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <header>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Kpi({ icon, label, value, sub, tone, badge }: { icon: IconName; label: string; value: string; sub?: string; tone?: 'good' | 'bad'; badge?: { tone: 'success' | 'warning' | 'danger'; text: string } }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>
        <Icon name={icon} size={14} /> {label}
      </span>
      <strong className={cx(styles.kpiValue, tone === 'good' && styles.good, tone === 'bad' && styles.bad)}>{value}</strong>
      {badge && (
        <Badge size="sm" tone={badge.tone} icon={badge.tone === 'success' ? 'check' : 'alert'}>
          {badge.text}
        </Badge>
      )}
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  )
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.miniKpi}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  )
}

function ProjectsTable({ rows, active, onPick }: { rows: ProjectRow[]; active: string; onPick: (p: string) => void }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Project</th>
            <th className={styles.num}>Screens</th>
            <th className={styles.num}>Quality</th>
            <th className={styles.num}>Review-ready</th>
            <th className={styles.num}>Hours saved</th>
            <th className={styles.num}>AI cost</th>
            <th className={styles.num}>Net value</th>
            <th className={styles.num}>ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.project} className={cx(r.project === active && styles.rowOn)} onClick={() => onPick(r.project)} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(r.project))} aria-selected={r.project === active}>
              <td data-label="Project">
                <span className={styles.projName}>
                  {r.project}
                  {r.sample && <Badge size="sm">sample</Badge>}
                </span>
                <small>
                  {r.runs} runs · {r.hitlDecisions} HITL
                </small>
              </td>
              <td className={styles.num} data-label="Screens">
                {r.screensBuilt}
              </td>
              <td className={styles.num} data-label="Quality">
                {r.avgQuality == null ? '—' : r.avgQuality.toFixed(2)}
              </td>
              <td className={styles.num} data-label="Review-ready">
                {pct(r.reviewReadyRate)}
              </td>
              <td className={styles.num} data-label="Hours saved">
                {hours(r.hoursSaved)}
              </td>
              <td className={styles.num} data-label="AI cost">
                {money(r.aiCost)}
              </td>
              <td className={cx(styles.num, r.net >= 0 ? styles.good : styles.bad)} data-label="Net value">
                {money(r.net, 0)}
              </td>
              <td className={styles.num} data-label="ROI">
                {r.roi == null ? '—' : `${Math.round(r.roi * 100).toLocaleString()}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
