/**
 * Small, dependency-free SVG charts for the ROI dashboard.
 * Conventions (dataviz method): thin marks with 4px rounded data-ends anchored to the baseline,
 * 2px surface gaps between adjacent fills, recessive grid/axes, one y-axis per chart,
 * hover tooltip on every mark, text in ink tokens (never the series colour).
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/utils/format'
import styles from './Roi.module.scss'

// ---- shared ---------------------------------------------------------------------
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

interface Tip {
  x: number
  y: number
  content: ReactNode
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null
  return (
    <div className={styles.tip} style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  )
}

/** Rounded rect with only the data-end corners rounded (bars grow from the baseline). */
function barPath(x: number, y: number, w: number, h: number, dir: 'up' | 'right' | 'left', r = 4) {
  if (w <= 0 || h <= 0) return ''
  const rr = Math.min(r, dir === 'up' ? w / 2 : h / 2, dir === 'up' ? h : w)
  if (dir === 'up') return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
  if (dir === 'right') return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`
  return `M${x + w},${y}H${x + rr}Q${x},${y} ${x},${y + rr}V${y + h - rr}Q${x},${y + h} ${x + rr},${y + h}H${x + w}Z`
}

const niceMax = (v: number) => {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((i) => (
        <li key={i.label}>
          <span className={cx(styles.swatch, i.dashed && styles.swatchDashed)} style={{ ['--c' as string]: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

// ---- Baseline vs actual (paired horizontal bars) -------------------------------------
interface CompareProps {
  title: string
  baseline: number
  actual: number
  format: (n: number) => string
  /** Which direction is an improvement. */
  better: 'lower' | 'higher'
  note?: string
}

export function CompareMetric({ title, baseline, actual, format, better, note }: CompareProps) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)
  const max = Math.max(baseline, actual, 1e-9)
  const change = baseline ? (actual - baseline) / baseline : 0
  const improved = better === 'lower' ? actual <= baseline : actual >= baseline
  const labelW = 64
  const valueW = 76
  const track = Math.max(40, w - labelW - valueW)
  const rows = [
    { key: 'Baseline', v: baseline, color: 'var(--viz-2)' },
    { key: 'Actual', v: actual, color: 'var(--viz-1)' },
  ]
  return (
    <figure className={styles.compare} aria-label={`${title}: baseline ${format(baseline)}, actual ${format(actual)}`}>
      <figcaption className={styles.compareHead}>
        <span>{title}</span>
        <span className={cx(styles.delta, improved ? styles.deltaGood : styles.deltaBad)}>
          {improved ? '▲' : '▼'} {Math.abs(change * 100).toFixed(change !== 0 && Math.abs(change) < 0.1 ? 1 : 0)}% {better === 'lower' ? (actual <= baseline ? 'less' : 'more') : actual >= baseline ? 'more' : 'less'}
        </span>
      </figcaption>
      <div ref={ref} className={styles.chartBox}>
        {w > 0 && (
          <svg width={w} height={64} role="img" aria-hidden>
            {rows.map((r, i) => {
              const y = 6 + i * 30
              const bw = (r.v / max) * track
              return (
                <g
                  key={r.key}
                  onMouseMove={(e) => setTip({ x: e.nativeEvent.offsetX, y: y - 6, content: <><b>{r.key}</b> {format(r.v)}</> })}
                  onMouseLeave={() => setTip(null)}
                >
                  <rect x={0} y={y - 4} width={w} height={26} fill="transparent" />
                  <text x={0} y={y + 13} className={styles.axisLabel}>
                    {r.key}
                  </text>
                  <path d={barPath(labelW, y, Math.max(bw, 2), 18, 'right')} fill={r.color} />
                  <text x={labelW + Math.max(bw, 2) + 6} y={y + 13} className={styles.valueLabel}>
                    {format(r.v)}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
        <Tooltip tip={tip} />
      </div>
      {note && <p className={styles.chartNote}>{note}</p>}
    </figure>
  )
}

// ---- Grouped columns (categories × baseline/actual) ----------------------------------
export function GroupedColumns({ data, format, height = 220 }: { data: { label: string; baseline: number; actual: number }[]; format: (n: number) => string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)
  const pad = { l: 48, r: 8, t: 12, b: 28 }
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.baseline, d.actual])))
  const ih = height - pad.t - pad.b
  const iw = Math.max(0, w - pad.l - pad.r)
  const group = iw / Math.max(1, data.length)
  const bar = Math.min(28, (group - 24) / 2)
  const y = (v: number) => pad.t + ih - (v / max) * ih
  return (
    <div ref={ref} className={styles.chartBox}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Hours by role, baseline versus actual">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(max * t)} y2={y(max * t)} className={t === 0 ? styles.baseline : styles.grid} />
              <text x={pad.l - 6} y={y(max * t) + 4} textAnchor="end" className={styles.axisLabel}>
                {format(max * t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx0 = pad.l + group * i + group / 2
            return (
              <g key={d.label}>
                {[
                  { k: 'Baseline', v: d.baseline, c: 'var(--viz-2)', x: cx0 - bar - 1 },
                  { k: 'Actual', v: d.actual, c: 'var(--viz-1)', x: cx0 + 1 },
                ].map((s) => (
                  <g key={s.k} onMouseMove={() => setTip({ x: s.x + bar / 2, y: y(s.v) - 8, content: <><b>{d.label}</b> · {s.k} {format(s.v)}</> })} onMouseLeave={() => setTip(null)}>
                    <rect x={s.x - 4} y={pad.t} width={bar + 8} height={ih} fill="transparent" />
                    <path d={barPath(s.x, y(s.v), bar, Math.max(0, pad.t + ih - y(s.v)), 'up')} fill={s.c} />
                  </g>
                ))}
                <text x={cx0} y={height - 8} textAnchor="middle" className={styles.axisLabel}>
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}

// ---- Two-line chart with crosshair (same unit) -------------------------------------
export function LinePair({
  points,
  series,
  format,
  height = 240,
}: {
  points: { x: number; values: number[] }[]
  series: { label: string; color: string; dashed?: boolean }[]
  format: (n: number) => string
  height?: number
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { l: 56, r: 12, t: 12, b: 26 }
  const iw = Math.max(0, w - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const max = niceMax(Math.max(1, ...points.flatMap((p) => p.values)))
  const n = points.length
  const X = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const Y = (v: number) => pad.t + ih - (v / max) * ih
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0]
  const fmtDay = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const p = hover != null ? points[hover] : null
  return (
    <div
      ref={ref}
      className={styles.chartBox}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        if (!n || iw <= 0) return
        const i = Math.round(((e.nativeEvent.offsetX - pad.l) / iw) * (n - 1))
        setHover(Math.max(0, Math.min(n - 1, i)))
      }}
    >
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(' versus ')}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={Y(max * t)} y2={Y(max * t)} className={t === 0 ? styles.baseline : styles.grid} />
              <text x={pad.l - 6} y={Y(max * t) + 4} textAnchor="end" className={styles.axisLabel}>
                {format(max * t)}
              </text>
            </g>
          ))}
          {ticks.map((i) => (
            <text key={i} x={X(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className={styles.axisLabel}>
              {points[i] ? fmtDay(points[i].x) : ''}
            </text>
          ))}
          {series.map((s, si) => (
            <path key={s.label} d={points.map((pt, i) => `${i ? 'L' : 'M'}${X(i)},${Y(pt.values[si])}`).join('')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" />
          ))}
          {/* Selective direct labels at the line ends. */}
          {n > 0 &&
            series.map((s, si) => (
              <circle key={s.label} cx={X(n - 1)} cy={Y(points[n - 1].values[si])} r={4} fill={s.color} stroke="var(--c-surface)" strokeWidth={2} />
            ))}
          {p && (
            <g>
              <line x1={X(hover!)} x2={X(hover!)} y1={pad.t} y2={pad.t + ih} className={styles.crosshair} />
              {series.map((s, si) => (
                <circle key={s.label} cx={X(hover!)} cy={Y(p.values[si])} r={5} fill={s.color} stroke="var(--c-surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {p && (
        <div className={styles.tip} style={{ left: X(hover!), top: pad.t }}>
          <b>{fmtDay(p.x)}</b>
          {series.map((s, si) => (
            <span key={s.label} className={styles.tipRow}>
              <i style={{ background: s.color }} /> {s.label} <b>{format(p.values[si])}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Daily columns with a reference line ------------------------------------------
export function DailyColumns({ data, format, reference, referenceLabel, height = 200 }: { data: { x: number; v: number }[]; format: (n: number) => string; reference?: number; referenceLabel?: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)
  const pad = { l: 48, r: 8, t: 14, b: 24 }
  const iw = Math.max(0, w - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const max = niceMax(Math.max(reference ?? 0, ...data.map((d) => d.v), 0.0001))
  const slot = iw / Math.max(1, data.length)
  const bw = Math.max(2, Math.min(18, slot - 2))
  const Y = (v: number) => pad.t + ih - (v / max) * ih
  const fmtDay = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <div ref={ref} className={styles.chartBox}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Daily AI spend">
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={Y(max * t)} y2={Y(max * t)} className={t === 0 ? styles.baseline : styles.grid} />
              <text x={pad.l - 6} y={Y(max * t) + 4} textAnchor="end" className={styles.axisLabel}>
                {format(max * t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + slot * i + (slot - bw) / 2
            return (
              <g key={d.x} onMouseMove={() => setTip({ x: x + bw / 2, y: Y(d.v) - 8, content: <><b>{fmtDay(d.x)}</b> {format(d.v)}</> })} onMouseLeave={() => setTip(null)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
                {d.v > 0 && <path d={barPath(x, Y(d.v), bw, pad.t + ih - Y(d.v), 'up', Math.min(4, bw / 2))} fill="var(--viz-1)" />}
              </g>
            )
          })}
          {reference != null && reference > 0 && (
            <g>
              <line x1={pad.l} x2={w - pad.r} y1={Y(reference)} y2={Y(reference)} className={styles.reference} />
              <text x={w - pad.r} y={Y(reference) - 5} textAnchor="end" className={styles.axisLabel}>
                {referenceLabel}
              </text>
            </g>
          )}
          {data.length > 1 && (
            <>
              <text x={pad.l} y={height - 6} className={styles.axisLabel}>
                {fmtDay(data[0].x)}
              </text>
              <text x={w - pad.r} y={height - 6} textAnchor="end" className={styles.axisLabel}>
                {fmtDay(data[data.length - 1].x)}
              </text>
            </>
          )}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}

// ---- Ranked horizontal bars (single series) ----------------------------------------
export function RankedBars({ rows, format, meta }: { rows: { label: string; v: number; sub?: string }[]; format: (n: number) => string; meta?: (i: number) => ReactNode }) {
  const max = Math.max(...rows.map((r) => r.v), 1e-9)
  return (
    <ul className={styles.ranked}>
      {rows.map((r, i) => (
        <li key={r.label} title={`${r.label}: ${format(r.v)}`}>
          <span className={styles.rankedLabel}>
            {r.label}
            {r.sub && <small>{r.sub}</small>}
          </span>
          <span className={styles.rankedTrack}>
            <span className={styles.rankedBar} style={{ width: `${Math.max(r.v > 0 ? 1.5 : 0, (r.v / max) * 100)}%` }} />
          </span>
          <span className={styles.rankedValue}>{format(r.v)}</span>
          {meta && <span className={styles.rankedMeta}>{meta(i)}</span>}
        </li>
      ))}
    </ul>
  )
}

// ---- 100% stacked share bar (≤ 3 series) --------------------------------------------
export function ShareBar({ parts, format }: { parts: { label: string; v: number; color: string }[]; format: (n: number) => string }) {
  const total = parts.reduce((n, p) => n + p.v, 0)
  const [tip, setTip] = useState<string | null>(null)
  return (
    <div className={styles.share}>
      <div className={styles.shareBar} role="img" aria-label={parts.map((p) => `${p.label} ${format(p.v)}`).join(', ')}>
        {parts
          .filter((p) => p.v > 0)
          .map((p) => (
            <span key={p.label} style={{ flexGrow: p.v, background: p.color }} onMouseEnter={() => setTip(`${p.label}: ${format(p.v)} (${((p.v / total) * 100).toFixed(0)}%)`)} onMouseLeave={() => setTip(null)} />
          ))}
      </div>
      <p className={styles.shareTip} aria-live="polite">
        {tip ?? ' '}
      </p>
      {/* Direct labels (relief rule: slot 3 is < 3:1 on the light surface). */}
      <ul className={styles.shareLabels}>
        {parts.map((p) => (
          <li key={p.label}>
            <span className={styles.swatch} style={{ ['--c' as string]: p.color }} aria-hidden />
            <span>{p.label}</span>
            <b>{format(p.v)}</b>
            <small>{total ? `${((p.v / total) * 100).toFixed(0)}%` : '—'}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- Value bridge (waterfall) -------------------------------------------------------
export function ValueBridge({ steps, format }: { steps: { label: string; v: number; total?: boolean }[]; format: (n: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)
  const rowH = 34
  const labelW = Math.min(150, w * 0.38)
  const valueW = 78
  const track = Math.max(40, w - labelW - valueW)
  // Running totals → each bar spans [start, end].
  let run = 0
  const bars = steps.map((s) => {
    const start = s.total ? 0 : run
    const end = s.total ? s.v : run + s.v
    if (!s.total) run = end
    return { ...s, start, end }
  })
  const lo = Math.min(0, ...bars.flatMap((b) => [b.start, b.end]))
  const hi = Math.max(0, ...bars.flatMap((b) => [b.start, b.end]))
  const X = (v: number) => labelW + ((v - lo) / (hi - lo || 1)) * track
  const height = bars.length * rowH + 8
  return (
    <div ref={ref} className={styles.chartBox}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={steps.map((s) => `${s.label} ${format(s.v)}`).join(', ')}>
          <line x1={X(0)} x2={X(0)} y1={0} y2={height} className={styles.baseline} />
          {bars.map((b, i) => {
            const y = 4 + i * rowH
            const x0 = X(Math.min(b.start, b.end))
            const bw = Math.max(2, Math.abs(X(b.end) - X(b.start)))
            const neg = b.total ? b.v < 0 : b.v < 0
            const color = b.total ? (neg ? 'var(--viz-neg)' : 'var(--viz-1)') : neg ? 'var(--viz-neg)' : 'var(--viz-pos)'
            return (
              <g key={b.label} onMouseMove={() => setTip({ x: x0 + bw / 2, y: y - 4, content: <><b>{b.label}</b> {format(b.v)}</> })} onMouseLeave={() => setTip(null)}>
                <rect x={0} y={y} width={w} height={rowH - 4} fill="transparent" />
                <text x={0} y={y + 18} className={cx(styles.axisLabel, b.total && styles.bold)}>
                  {b.label}
                </text>
                <path d={barPath(x0, y + 4, bw, 20, neg ? 'left' : 'right')} fill={color} opacity={b.total ? 1 : 0.92} />
                <text x={w} y={y + 18} textAnchor="end" className={cx(styles.valueLabel, b.total && styles.bold)}>
                  {b.v >= 0 && !b.total ? '+' : ''}
                  {format(b.v)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}
