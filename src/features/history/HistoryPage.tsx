import { useMemo, useState } from 'react'
import { useHistory } from '@/app/providers/HistoryProvider'
import { useRun } from '@/app/providers/RunProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { THRESHOLDS } from '@/config/app'
import { RUN_HISTORY } from '@/data/runHistory'
import { PageHeader } from '@/features/nav/PageHeader'
import type { ThreadSummary } from '@/services/history/threadStore'
import { cx, formatRelative } from '@/utils/format'
import styles from './HistoryPage.module.scss'

interface Props {
  onOpen: (id: string) => void
  onNewChat: () => void
  onRerun: (prompt: string) => void
}

const DAY = 86_400_000

function group(threads: ThreadSummary[]) {
  const start = new Date().setHours(0, 0, 0, 0)
  const buckets: { label: string; items: ThreadSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ]
  for (const t of threads) {
    const i = t.updatedAt >= start ? 0 : t.updatedAt >= start - DAY ? 1 : t.updatedAt >= start - 7 * DAY ? 2 : 3
    buckets[i].items.push(t)
  }
  return buckets.filter((b) => b.items.length)
}

/** Chat history: every conversation (with its screens) is saved and can be reopened. */
export function HistoryPage({ onOpen, onNewChat, onRerun }: Props) {
  const { threads, loaded, rename, remove } = useHistory()
  const { state, isBusy } = useRun()
  const notify = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? threads.filter((t) => `${t.title} ${t.preview} ${t.screens.map((s) => s.title).join(' ')}`.toLowerCase().includes(q)) : threads
  }, [threads, query])

  const totals = useMemo(() => {
    const screens = threads.flatMap((t) => t.screens)
    const scored = screens.filter((s) => s.score != null)
    return {
      chats: threads.length,
      screens: screens.length,
      signed: screens.filter((s) => s.signedOff).length,
      avg: scored.length ? scored.reduce((n, s) => n + (s.score ?? 0), 0) / scored.length : null,
    }
  }, [threads])

  const commitRename = async (id: string) => {
    await rename(id, draft)
    setEditing(null)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        icon="history"
        title="Chat history"
        subtitle="Every conversation is saved on this device with its screens, code, specs and quality reports."
        actions={
          <Button variant="primary" icon="plus" onClick={onNewChat} disabled={isBusy}>
            New chat
          </Button>
        }
      />

      <div className={styles.body}>
        <section className={styles.kpis} aria-label="Totals">
          <div>
            <span>Conversations</span>
            <strong>{totals.chats}</strong>
          </div>
          <div>
            <span>Screens built</span>
            <strong>{totals.screens}</strong>
          </div>
          <div>
            <span>Signed off</span>
            <strong>{totals.signed}</strong>
          </div>
          <div>
            <span>Avg. quality</span>
            <strong className={cx(totals.avg != null && (totals.avg >= THRESHOLDS.deliver ? styles.good : styles.warn))}>{totals.avg != null ? totals.avg.toFixed(2) : '—'}</strong>
          </div>
        </section>

        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input type="search" placeholder="Search conversations, prompts or screens…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search chat history" />
        </label>

        {!loaded ? (
          <p className={styles.muted}>Loading history…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="message" title={threads.length ? 'No matches' : 'No conversations yet'} description={threads.length ? 'Try a different search.' : 'Start a chat — it is saved here automatically once the first run finishes.'}>
            {!threads.length && (
              <Button icon="plus" onClick={onNewChat}>
                New chat
              </Button>
            )}
          </EmptyState>
        ) : (
          group(filtered).map((g) => (
            <section key={g.label} className={styles.group}>
              <h2>{g.label}</h2>
              <ul className={styles.list}>
                {g.items.map((t) => {
                  const current = t.id === state.threadId
                  return (
                    <li key={t.id} className={cx(styles.row, current && styles.rowOn)}>
                      <button type="button" className={styles.open} onClick={() => onOpen(t.id)} disabled={isBusy && !current} aria-label={`Open ${t.title}`}>
                        <span className={styles.avatar} aria-hidden>
                          <Icon name="message" size={16} />
                        </span>
                        <span className={styles.main}>
                          {editing === t.id ? null : (
                            <span className={styles.title}>
                              {t.title}
                              {current && (
                                <Badge size="sm" tone="primary">
                                  current
                                </Badge>
                              )}
                            </span>
                          )}
                          <span className={styles.preview}>{t.preview}</span>
                          {t.screens.length > 0 && (
                            <span className={styles.screens}>
                              {t.screens.slice(0, 5).map((s) => (
                                <span key={s.id} className={cx(styles.screen, s.score != null && (s.score >= THRESHOLDS.deliver ? styles.good : styles.warn))}>
                                  {s.signedOff && <Icon name="check" size={10} strokeWidth={3} />}
                                  {s.title}
                                  {s.score != null && <b>{s.score.toFixed(2)}</b>}
                                </span>
                              ))}
                              {t.screens.length > 5 && <span className={styles.screen}>+{t.screens.length - 5}</span>}
                            </span>
                          )}
                        </span>
                        <span className={styles.when}>{formatRelative(t.updatedAt)}</span>
                      </button>

                      {editing === t.id && (
                        <form
                          className={styles.rename}
                          onSubmit={(e) => {
                            e.preventDefault()
                            void commitRename(t.id)
                          }}
                        >
                          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Conversation title" onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                          <IconButton type="submit" size="sm" icon="check" label="Save title" variant="primary" />
                          <IconButton size="sm" icon="x" label="Cancel" onClick={() => setEditing(null)} />
                        </form>
                      )}

                      <div className={styles.actions}>
                        {confirm === t.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                void remove(t.id)
                                setConfirm(null)
                                notify('Conversation deleted', 'info')
                              }}
                            >
                              Delete
                            </Button>
                            <IconButton size="sm" icon="x" label="Keep" onClick={() => setConfirm(null)} />
                          </>
                        ) : (
                          <>
                            <IconButton
                              size="sm"
                              icon="edit"
                              label={`Rename ${t.title}`}
                              onClick={() => {
                                setEditing(t.id)
                                setDraft(t.title)
                              }}
                            />
                            <IconButton size="sm" icon="trash" label={`Delete ${t.title}`} onClick={() => setConfirm(t.id)} disabled={current && isBusy} />
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}

        <details className={styles.samples}>
          <summary>
            <Icon name="activity" size={14} /> Pilot sample runs ({RUN_HISTORY.length})
          </summary>
          <ul>
            {RUN_HISTORY.map((r) => (
              <li key={r.id}>
                <span className={styles.sampleTitle}>
                  <strong>{r.title}</strong>
                  <span>“{r.prompt}”</span>
                </span>
                <Badge size="sm" tone={r.status === 'delivered' ? 'success' : r.status === 'escalated' ? 'danger' : 'neutral'}>
                  {r.status}
                </Badge>
                <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => onRerun(r.prompt)} disabled={isBusy}>
                  Re-run
                </Button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
