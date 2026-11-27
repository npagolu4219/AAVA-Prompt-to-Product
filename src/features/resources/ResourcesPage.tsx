import { useMemo, useState } from 'react'
import { useResources } from '@/app/providers/ResourcesProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/features/nav/PageHeader'
import { RESOURCE_KINDS, kindMeta } from '@/services/resources/catalog'
import type { Resource, ResourceKind } from '@/types/resources'
import { cx, formatRelative } from '@/utils/format'
import { ResourceForm } from './ResourceForm'
import styles from './Resources.module.scss'

const CONTEXT_BUDGET = 8000
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/**
 * Context & resources: org codebases, Figma libraries, design-system docs, API specs, knowledge
 * docs and uploads. Enabled resources ground every conversation; any can be @mentioned in a prompt.
 */
export function ResourcesPage() {
  const { resources, enabled, toggle, reindex, remove } = useResources()
  const notify = useToast()
  const [filter, setFilter] = useState<ResourceKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const shown = useMemo(
    () =>
      resources.filter(
        (r) => (filter === 'all' || r.kind === filter) && (!query || `${r.name} ${r.handle} ${kindMeta(r.kind).source(r.config)}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [resources, filter, query],
  )

  // Retrieval only pulls top-k chunks per resource, so the per-run budget is bounded.
  const perRun = Math.min(CONTEXT_BUDGET, enabled.reduce((n, r) => n + Math.min(1800, Math.round((r.stats?.tokens ?? 0) * 0.002) + 400), 0))
  const indexedTokens = resources.reduce((n, r) => n + (r.stats?.tokens ?? 0), 0)

  return (
    <div className={styles.page}>
      <PageHeader
        icon="layers"
        title="Context & resources"
        subtitle="Connect your org codebase, Figma libraries and docs. Agents ground every conversation on enabled sources — or @mention one in a prompt."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Add resource
          </Button>
        }
      />

      <div className={styles.body}>
        <section className={styles.summary} aria-label="Context summary">
          <div className={styles.stat}>
            <span>Active in conversations</span>
            <strong>
              {enabled.length}
              <small> / {resources.length}</small>
            </strong>
          </div>
          <div className={styles.stat}>
            <span>Indexed content</span>
            <strong>{fmt(indexedTokens)} tokens</strong>
          </div>
          <div className={cx(styles.stat, styles.budget)}>
            <span>Retrieved per run (top-k)</span>
            <strong>
              ~{fmt(perRun)}
              <small> / {fmt(CONTEXT_BUDGET)}</small>
            </strong>
            <span className={styles.meter} aria-hidden>
              <span style={{ width: `${(perRun / CONTEXT_BUDGET) * 100}%` }} />
            </span>
          </div>
          <div className={cx(styles.stat, styles.how)}>
            <Icon name="at" size={16} />
            <p>
              Type <code>@</code> in the composer to reference a resource — e.g. <code>@{resources[0]?.handle ?? 'web-portal'}</code> — even if it’s turned off.
            </p>
          </div>
        </section>

        <div className={styles.toolbar}>
          <div className={styles.filters} role="tablist" aria-label="Resource types">
            <button type="button" role="tab" aria-selected={filter === 'all'} className={cx(styles.filter, filter === 'all' && styles.filterOn)} onClick={() => setFilter('all')}>
              All <span>{resources.length}</span>
            </button>
            {RESOURCE_KINDS.map((k) => {
              const n = resources.filter((r) => r.kind === k.kind).length
              return (
                <button key={k.kind} type="button" role="tab" aria-selected={filter === k.kind} className={cx(styles.filter, filter === k.kind && styles.filterOn)} onClick={() => setFilter(k.kind)}>
                  <Icon name={k.icon} size={13} />
                  {k.label}
                  {n > 0 && <span>{n}</span>}
                </button>
              )
            })}
          </div>
          <label className={styles.search}>
            <Icon name="search" size={14} />
            <input type="search" placeholder="Search resources…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search resources" />
          </label>
        </div>

        {shown.length === 0 ? (
          <EmptyState icon="layers" title={resources.length ? 'No matching resources' : 'No context yet'} description="Add your org codebase, a Figma library or docs so generated screens match how your team already builds.">
            <Button icon="plus" onClick={() => setFormOpen(true)}>
              Add resource
            </Button>
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {shown.map((r) => {
              const meta = kindMeta(r.kind)
              return (
                <article key={r.id} className={cx(styles.card, !r.enabled && styles.cardOff, r.status === 'error' && styles.cardError)}>
                  <header className={styles.cardHead}>
                    <span className={cx(styles.kindIcon, styles[`k_${r.kind.replace('-', '_')}`])} aria-hidden>
                      <Icon name={meta.icon} size={18} />
                    </span>
                    <div className={styles.cardTitle}>
                      <strong>{r.name}</strong>
                      <code>@{r.handle}</code>
                    </div>
                    <label className={styles.switch} title={r.enabled ? 'Used in conversations' : 'Not used (still @mentionable)'}>
                      <input type="checkbox" role="switch" checked={r.enabled} disabled={r.status !== 'indexed'} onChange={() => toggle(r.id)} aria-label={`Use ${r.name} in conversations`} />
                      <span aria-hidden />
                    </label>
                  </header>

                  <p className={styles.source}>
                    <Badge size="sm">{meta.label}</Badge>
                    <span>{meta.source(r.config)}</span>
                  </p>

                  {r.status === 'indexing' || r.status === 'pending' ? (
                    <div className={styles.indexing}>
                      <span>
                        <span className={styles.spinner} /> {r.message ?? 'Queued…'}
                      </span>
                      <span className={styles.progress}>
                        <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
                      </span>
                    </div>
                  ) : r.status === 'error' ? (
                    <p className={styles.errorLine}>
                      <Icon name="alert" size={13} /> {r.message}
                    </p>
                  ) : (
                    r.stats && (
                      <>
                        <ul className={styles.highlights}>
                          {r.stats.highlights.filter(Boolean).map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                        <dl className={styles.stats}>
                          <div>
                            <dt>Files</dt>
                            <dd>{fmt(r.stats.files)}</dd>
                          </div>
                          <div>
                            <dt>Chunks</dt>
                            <dd>{fmt(r.stats.chunks)}</dd>
                          </div>
                          <div>
                            <dt>Tokens</dt>
                            <dd>{fmt(r.stats.tokens)}</dd>
                          </div>
                        </dl>
                      </>
                    )
                  )}

                  <footer className={styles.cardFoot}>
                    <span className={styles.status}>
                      <span className={cx(styles.dot, styles[`s_${r.status}`])} />
                      {r.status === 'indexed' ? `Indexed ${r.indexedAt ? formatRelative(r.indexedAt) : ''}` : r.status}
                    </span>
                    {confirm === r.id ? (
                      <span className={styles.confirm}>
                        <Button size="sm" variant="danger" onClick={() => (remove(r.id), setConfirm(null), notify(`Removed ${r.name}`, 'info'))}>
                          Remove
                        </Button>
                        <IconButton size="sm" icon="x" label="Keep" onClick={() => setConfirm(null)} />
                      </span>
                    ) : (
                      <span className={styles.cardActions}>
                        <IconButton size="sm" icon="refresh" label={`Re-index ${r.name}`} onClick={() => reindex(r.id)} disabled={r.status === 'indexing'} />
                        <IconButton
                          size="sm"
                          icon="edit"
                          label={`Edit ${r.name}`}
                          onClick={() => {
                            setEditing(r)
                            setFormOpen(true)
                          }}
                        />
                        <IconButton size="sm" icon="trash" label={`Remove ${r.name}`} onClick={() => setConfirm(r.id)} />
                      </span>
                    )}
                  </footer>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <ResourceForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  )
}
