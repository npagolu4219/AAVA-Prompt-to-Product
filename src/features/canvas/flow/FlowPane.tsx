import { useMemo, useState, type DragEvent } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Switch'
import { MAX_SCREENS, THRESHOLDS } from '@/config/app'
import { requestNewScreen } from '@/features/screens/ScreenStrip'
import { useFlip } from '@/hooks/useFlip'
import { actionsOf } from '@/state/runReducer'
import type { ScreenState } from '@/types/project'
import { cx } from '@/utils/format'
import { A2uiSurface } from '../preview/A2uiSurface'
import styles from './FlowPane.module.scss'

const noop = () => undefined

/** Walk the links from the first screen to show the primary happy path. */
function happyPath(screens: ScreenState[]): ScreenState[] {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const path: ScreenState[] = []
  let cur: ScreenState | undefined = screens[0]
  while (cur && !path.includes(cur)) {
    path.push(cur)
    cur = byId.get(cur.links[0]?.targetId ?? '')
  }
  return path
}

const swap = (arr: string[], a: number, b: number) => {
  const next = [...arr]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

interface Props {
  onOpen: () => void
}

/**
 * User-flow map: every screen, its navigation edges, a link editor, and a reorder mode
 * (drag-to-swap · ←/→ · "Swap with…") with a confirm step. Cards animate to their new slots.
 */
export function FlowPane({ onOpen }: Props) {
  const { state, selectScreen, deleteScreen, linkScreens, reorderScreens, isBusy } = useRun()
  const notify = useToast()
  const screens = useMemo(() => state.screens.filter((s) => s.surface), [state.screens])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Reorder mode: a draft order the user edits, applied only on confirm.
  const [draft, setDraft] = useState<string[] | null>(null)
  const [relink, setRelink] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const reordering = draft !== null

  const byId = useMemo(() => new Map(screens.map((s) => [s.id, s])), [screens])
  const original = screens.map((s) => s.id)
  const order = (draft ?? original).filter((id) => byId.has(id))
  const shown = order.map((id) => byId.get(id)!)
  const moved = order.filter((id, i) => original[i] !== id).length
  const path = useMemo(() => happyPath(screens), [screens])
  const flip = useFlip(order)

  if (screens.length === 0) {
    return (
      <EmptyState icon="flow" title="No flow yet" description={`Each prompt in this chat adds a screen (up to ${MAX_SCREENS}). Signed-off screens are linked automatically: the previous screen’s primary action opens the next one.`}>
        <Button size="sm" icon="plus" onClick={requestNewScreen}>
          Add first screen
        </Button>
      </EmptyState>
    )
  }

  const incoming = (id: string) => screens.filter((s) => s.links.some((l) => l.targetId === id))

  const swapIds = (a: string, b: string) => {
    if (!draft || a === b) return
    setDraft(swap(draft, draft.indexOf(a), draft.indexOf(b)))
  }
  const move = (id: string, dir: -1 | 1) => {
    if (!draft) return
    const i = draft.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= draft.length) return
    setDraft(swap(draft, i, j))
  }

  const startReorder = () => {
    setDraft(original)
    setConfirmDelete(null)
  }
  const cancel = () => {
    setDraft(null)
    setDragId(null)
    setOverId(null)
  }
  const confirm = () => {
    if (!draft) return
    reorderScreens(draft, relink)
    notify(moved ? `Flow reordered · ${moved} screen(s) moved` : 'Order unchanged', moved ? 'success' : 'info')
    cancel()
  }

  const dragProps = (id: string) =>
    reordering
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            setDragId(id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', id)
          },
          onDragOver: (e: DragEvent) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (overId !== id) setOverId(id)
          },
          onDragLeave: () => setOverId((o) => (o === id ? null : o)),
          onDrop: (e: DragEvent) => {
            e.preventDefault()
            const from = e.dataTransfer.getData('text/plain') || dragId
            if (from) swapIds(from, id)
            setDragId(null)
            setOverId(null)
          },
          onDragEnd: () => {
            setDragId(null)
            setOverId(null)
          },
        }
      : {}

  return (
    <div className={cx(styles.pane, reordering && styles.paneReorder)}>
      <header className={styles.head}>
        <div>
          <h3>User flow</h3>
          <p>
            {screens.length} of {MAX_SCREENS} screens · {screens.reduce((n, s) => n + s.links.length, 0)} navigation links ·{' '}
            {reordering ? 'drag a screen onto another to swap them, or use the arrows.' : 'click actions in Preview to walk the flow.'}
          </p>
        </div>
        <div className={styles.headActions}>
          {!reordering && screens.length > 1 && (
            <Button size="sm" icon="refresh" onClick={startReorder} disabled={isBusy} title={isBusy ? 'Wait for the current run to finish' : 'Reorder screens'}>
              Reorder
            </Button>
          )}
          {!reordering && (
            <Button size="sm" icon="plus" onClick={requestNewScreen} disabled={isBusy || screens.length >= MAX_SCREENS}>
              Add screen
            </Button>
          )}
        </div>
      </header>

      {reordering ? (
        <ol className={cx(styles.path, styles.pathDraft)} aria-label="New order">
          {shown.map((s, i) => (
            <li key={s.id}>
              {i > 0 && <Icon name="arrowRight" size={14} className={styles.edgeIcon} />}
              <span className={cx(styles.pathNode, original[i] !== s.id && styles.pathMoved)}>
                <b>{i + 1}</b> {s.shared.title}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className={styles.path} aria-label="Primary path">
          {path.map((s, i) => (
            <li key={s.id}>
              {i > 0 && (
                <span className={styles.edge}>
                  <code>{path[i - 1].links[0]?.action}</code>
                  <Icon name="arrowRight" size={14} />
                </span>
              )}
              <button type="button" className={cx(styles.pathNode, s.id === state.activeScreenId && styles.pathOn)} onClick={() => selectScreen(s.id)}>
                {s.shared.title}
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.grid}>
        {shown.map((s, i) => {
          const q = s.shared.quality
          const actions = actionsOf(s)
          const inbound = incoming(s.id)
          const was = original.indexOf(s.id)
          return (
            <article
              key={s.id}
              ref={flip(s.id)}
              className={cx(
                styles.card,
                !reordering && s.id === state.activeScreenId && styles.cardOn,
                reordering && styles.cardDraggable,
                dragId === s.id && styles.cardDragging,
                overId === s.id && dragId !== s.id && styles.cardDrop,
                reordering && was !== i && styles.cardMoved,
              )}
              aria-roledescription={reordering ? 'Reorderable screen' : undefined}
              {...dragProps(s.id)}
            >
              <button
                type="button"
                className={styles.thumb}
                onClick={() => {
                  if (reordering) return
                  selectScreen(s.id)
                  onOpen()
                }}
                aria-label={reordering ? `${s.shared.title}, position ${i + 1}` : `Open ${s.shared.title} in Preview`}
                tabIndex={reordering ? -1 : 0}
              >
                <div className={styles.thumbInner} aria-hidden inert>
                  {s.surface && <A2uiSurface surface={s.surface} onData={noop} onAction={noop} />}
                </div>
                <span className={styles.idx}>{i + 1}</span>
                {reordering && (
                  <span className={styles.grip} aria-hidden>
                    <Icon name="grid" size={14} /> Drag to swap
                  </span>
                )}
                {reordering && was !== i && (
                  <span className={styles.movedBadge}>
                    was {was + 1} → {i + 1}
                  </span>
                )}
              </button>

              <div className={styles.meta}>
                <div className={styles.titleRow}>
                  <strong>{s.shared.title}</strong>
                  {reordering ? (
                    <span className={styles.moveBtns}>
                      <IconButton size="sm" icon="chevronLeft" label={`Move ${s.shared.title} earlier`} onClick={() => move(s.id, -1)} disabled={i === 0} />
                      <IconButton size="sm" icon="chevronRight" label={`Move ${s.shared.title} later`} onClick={() => move(s.id, 1)} disabled={i === shown.length - 1} />
                    </span>
                  ) : confirmDelete === s.id ? (
                    <span className={styles.confirm}>
                      <Button size="sm" variant="danger" onClick={() => (deleteScreen(s.id), setConfirmDelete(null))}>
                        Delete
                      </Button>
                      <IconButton size="sm" icon="x" label="Keep screen" onClick={() => setConfirmDelete(null)} />
                    </span>
                  ) : (
                    <IconButton size="sm" icon="trash" label={`Delete ${s.shared.title}`} onClick={() => setConfirmDelete(s.id)} disabled={isBusy && state.runScreenId === s.id} />
                  )}
                </div>
                <code className={styles.route}>{s.route}</code>

                {reordering ? (
                  <label className={styles.swapWith}>
                    <span>Swap with</span>
                    <select value="" onChange={(e) => e.target.value && swapIds(s.id, e.target.value)} aria-label={`Swap ${s.shared.title} with`}>
                      <option value="">— choose screen —</option>
                      {shown
                        .filter((t) => t.id !== s.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {shown.indexOf(t) + 1}. {t.shared.title}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <div className={styles.badges}>
                      {q && (
                        <Badge size="sm" tone={q.score >= THRESHOLDS.deliver ? 'success' : q.score >= THRESHOLDS.autofix ? 'warning' : 'danger'}>
                          {q.score.toFixed(2)}
                        </Badge>
                      )}
                      <Badge size="sm">v{s.shared.version}</Badge>
                      {s.signedOff ? (
                        <Badge size="sm" tone="success" icon="check">
                          signed off
                        </Badge>
                      ) : (
                        <Badge size="sm">draft</Badge>
                      )}
                      {s.shared.bindings.length > 0 && (
                        <Badge size="sm" tone="info" icon="database">
                          {new Set(s.shared.bindings.map((b) => b.table)).size} table(s)
                        </Badge>
                      )}
                    </div>
                    {inbound.length > 0 && (
                      <p className={styles.inbound}>
                        <Icon name="arrowRight" size={12} /> from {inbound.map((x) => x.shared.title).join(', ')}
                      </p>
                    )}
                  </>
                )}
              </div>

              {!reordering && actions.length > 0 && (
                <div className={styles.links}>
                  <span className={styles.linksLabel}>Navigation</span>
                  {actions.map((a) => {
                    const link = s.links.find((l) => l.action === a.name)
                    return (
                      <label key={`${a.id}-${a.name}`} className={styles.link}>
                        <span className={styles.action} title={`#${a.id}`}>
                          {a.label}
                        </span>
                        <Icon name="arrowRight" size={12} />
                        <select value={link?.targetId ?? ''} onChange={(e) => linkScreens(s.id, a.name, e.target.value || null)} aria-label={`${a.label} navigates to`}>
                          <option value="">— agent handles —</option>
                          {screens
                            .filter((t) => t.id !== s.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.shared.title}
                              </option>
                            ))}
                        </select>
                      </label>
                    )
                  })}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {reordering && (
        <div className={styles.confirmBar} role="region" aria-label="Confirm new order">
          <div className={styles.confirmText}>
            <strong>{moved ? `${moved} screen${moved === 1 ? '' : 's'} moved` : 'No changes yet'}</strong>
            <Switch label="Re-link primary navigation in this order" description="Each screen’s main action will open the next screen." checked={relink} onChange={setRelink} />
          </div>
          <div className={styles.confirmActions}>
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={confirm} disabled={!moved && !relink}>
              Confirm order
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
