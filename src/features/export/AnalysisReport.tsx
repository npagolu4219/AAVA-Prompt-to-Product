import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { CodeAnalysis, FindingSeverity } from '@/types/export'
import { cx } from '@/utils/format'
import styles from './export.module.scss'

const SEV: Record<FindingSeverity, { icon: IconName; tone: 'danger' | 'warning' | 'info' }> = {
  error: { icon: 'alert', tone: 'danger' },
  warning: { icon: 'alert', tone: 'warning' },
  info: { icon: 'info', tone: 'info' },
}

/** Metrics + findings from the static analysis of the generated project. */
export function AnalysisReport({ analysis, compact }: { analysis: CodeAnalysis; compact?: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const findings = showAll ? analysis.findings : analysis.findings.slice(0, compact ? 4 : 8)

  return (
    <div className={styles.analysis}>
      <div className={styles.metrics}>
        <Metric label="Files" value={analysis.files} />
        <Metric label="Lines of code" value={analysis.loc.toLocaleString()} />
        <Metric label="Size" value={`${(analysis.bytes / 1024).toFixed(1)} KB`} />
        <Metric label="Dependencies" value={analysis.dependencies.length} />
        <Metric label="Routes" value={analysis.routes.length} />
        <Metric label="DB collections" value={analysis.bindings} />
      </div>

      <div className={styles.verdict}>
        <Badge tone={analysis.counts.error ? 'danger' : 'success'} icon={analysis.counts.error ? 'alert' : 'shieldCheck'}>
          {analysis.counts.error} error{analysis.counts.error === 1 ? '' : 's'}
        </Badge>
        <Badge tone={analysis.counts.warning ? 'warning' : 'neutral'}>{analysis.counts.warning} warnings</Badge>
        <Badge tone="info">{analysis.counts.info} info</Badge>
        {!compact && (
          <span className={styles.langs}>
            {analysis.byLanguage.slice(0, 5).map((l) => (
              <span key={l.language}>
                {l.language} <b>{l.loc}</b>
              </span>
            ))}
          </span>
        )}
      </div>

      {analysis.findings.length === 0 ? (
        <p className={styles.clean}>
          <Icon name="shieldCheck" size={16} /> No findings — tokens only, labelled inputs, every screen signed off.
        </p>
      ) : (
        <ul className={styles.findings}>
          {findings.map((f, i) => (
            <li key={i} className={cx(styles.finding, styles[f.severity])}>
              <Icon name={SEV[f.severity].icon} size={14} />
              <span className={styles.findingRule}>{f.rule}</span>
              <span className={styles.findingMsg}>{f.message}</span>
              {f.file && (
                <code className={styles.findingFile}>
                  {f.file}
                  {f.line ? `:${f.line}` : ''}
                </code>
              )}
            </li>
          ))}
          {analysis.findings.length > findings.length && (
            <li>
              <button type="button" className={styles.more} onClick={() => setShowAll(true)}>
                Show {analysis.findings.length - findings.length} more
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
