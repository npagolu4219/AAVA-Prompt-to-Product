import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useHistory } from '@/app/providers/HistoryProvider'
import { useResources } from '@/app/providers/ResourcesProvider'
import { useRun } from '@/app/providers/RunProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { Icon, type IconName } from '@/components/ui/Icon'
import { STEP_NAMES } from '@/config/app'
import { useEscape } from '@/hooks'
import { cx, formatRelative } from '@/utils/format'
import type { Route } from './routing'
import styles from './AppNav.module.scss'

interface Props {
  route: Route
  expanded: boolean
  onToggleExpanded: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  onNavigate: (r: Route) => void
  onNewChat: () => void
  onOpenThread: (id: string) => void
  onOpenData: () => void
  onOpenSettings: () => void
}

interface Item {
  route: Route
  label: string
  icon: IconName
  hint: string
  badge?: number
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

/**
 * App navigation.
 *  Desktop: a rail that expands (labels, sections, recent chats) — ⌘/Ctrl+B toggles it.
 *  Phones: the same content as an off-canvas drawer with a staggered entrance.
 * A single pill slides between items to mark the active page.
 */
export function AppNav(p: Props) {
  const { state, isBusy } = useRun()
  const { threads } = useHistory()
  const { enabled } = useResources()
  const { resolvedMode, update } = useTheme()
  const panel = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<Route, HTMLAnchorElement>())
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null)
  useEscape(p.mobileOpen, p.onCloseMobile)

  const open = p.expanded || p.mobileOpen
  const screens = state.screens.filter((s) => s.surface).length

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Build',
      items: [
        { route: 'home', label: 'Home', icon: 'home', hint: 'Start a new idea' },
        { route: 'studio', label: 'Studio', icon: 'layout', hint: 'Chat, steps & canvas', badge: screens || undefined },
        { route: 'resources', label: 'Context', icon: 'layers', hint: 'Codebase, Figma & docs', badge: enabled.length || undefined },
      ],
    },
    {
      title: 'Insights',
      items: [
        { route: 'history', label: 'History', icon: 'history', hint: 'Saved conversations', badge: threads.length || undefined },
        { route: 'roi', label: 'ROI', icon: 'trendingUp', hint: 'Value, hours & AI cost' },
      ],
    },
  ]

  // Slide the active pill to the current item (re-measured when layout changes).
  const measure = useCallback(() => {
    const el = itemRefs.current.get(p.route)
    const host = list.current
    if (!el || !host) return setPill(null)
    const a = el.getBoundingClientRect()
    const b = host.getBoundingClientRect()
    setPill({ top: a.top - b.top + host.scrollTop, height: a.height })
  }, [p.route])

  useLayoutEffect(() => {
    measure()
  }, [measure, p.expanded, p.mobileOpen, threads.length])

  useEffect(() => {
    const host = panel.current
    if (!host) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(host)
    return () => ro.disconnect()
  }, [measure])

  // ⌘/Ctrl+B toggles the rail (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b' || e.shiftKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.closest('.monaco-editor'))) return
      e.preventDefault()
      p.onToggleExpanded()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p])

  useEffect(() => {
    if (p.mobileOpen) panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [p.mobileOpen])

  const go = (r: Route) => {
    p.onNavigate(r)
    p.onCloseMobile()
  }

  // Run progress for the live status card.
  const done = state.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length
  const current = state.steps.find((s) => s.status === 'running' || s.status === 'waiting')
  const progress = Math.min(1, (done + (current ? 0.5 : 0)) / STEP_NAMES.length)
  const runScreen = state.screens.find((s) => s.id === state.runScreenId)

  let order = 0
  const stagger = (): CSSProperties => ({ ['--i' as string]: order++ })

  return (
    <>
      <div className={cx(styles.scrim, p.mobileOpen && styles.scrimOn)} onClick={p.onCloseMobile} aria-hidden />
      <nav ref={panel} className={cx(styles.nav, open && styles.open, p.expanded && styles.expanded, p.mobileOpen && styles.mobileOpen)} aria-label="Main">
        {/* Brand */}
        <div className={styles.top} style={stagger()}>
          <a className={styles.brand} href="#/" onClick={() => p.onCloseMobile()} aria-label="AAVA Prompt-to-Product home">
            <span className={styles.mark} aria-hidden>
              <svg viewBox="0 0 32 32" width="34" height="34">
                <rect width="32" height="32" rx="10" fill="url(#navMark)" />
                <defs>
                  <linearGradient id="navMark" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="var(--c-primary)" />
                    <stop offset="1" stopColor="color-mix(in srgb, var(--c-primary) 55%, var(--c-accent))" />
                  </linearGradient>
                </defs>
                <path d="M9.5 22.5 16 9l6.5 13.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 18h8" stroke="#fff" strokeOpacity=".75" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className={styles.word}>
              <strong>AAVA</strong>
              <span>Prompt-to-Product</span>
            </span>
          </a>
          {p.mobileOpen && (
            <button type="button" className={styles.close} onClick={p.onCloseMobile} aria-label="Close menu">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        {/* Collapse handle on the rail edge (desktop/tablet) */}
        <button type="button" className={styles.handle} onClick={p.onToggleExpanded} aria-label={p.expanded ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={p.expanded} title={`${p.expanded ? 'Collapse' : 'Expand'} (${MOD}+B)`}>
          <Icon name={p.expanded ? 'chevronLeft' : 'chevronRight'} size={14} strokeWidth={2.6} />
        </button>

        {/* New chat */}
        <button type="button" className={styles.newChat} style={stagger()} onClick={() => (p.onNewChat(), p.onCloseMobile())} disabled={isBusy} data-autofocus data-tip="New chat">
          <span className={styles.newIcon}>
            <Icon name="plus" size={18} strokeWidth={2.4} />
          </span>
          <span className={styles.label}>New chat</span>
          <span className={styles.shine} aria-hidden />
        </button>

        {/* Groups */}
        <div ref={list} className={styles.groups}>
          {pill && <span className={styles.pill} style={{ transform: `translateY(${pill.top}px)`, height: pill.height }} aria-hidden />}
          {groups.map((g) => (
            <div key={g.title} className={styles.group}>
              <span className={styles.groupTitle} style={stagger()}>
                <span className={styles.label}>{g.title}</span>
              </span>
              <ul>
                {g.items.map((it) => {
                  const active = p.route === it.route
                  const live = it.route === 'studio' && isBusy
                  return (
                    <li key={it.route} style={stagger()}>
                      <a
                        ref={(el) => {
                          if (el) itemRefs.current.set(it.route, el)
                          else itemRefs.current.delete(it.route)
                        }}
                        href={it.route === 'home' ? '#/' : `#/${it.route}`}
                        className={cx(styles.item, active && styles.active)}
                        aria-current={active ? 'page' : undefined}
                        data-tip={it.label}
                        onClick={(e) => {
                          e.preventDefault()
                          go(it.route)
                        }}
                      >
                        <span className={cx(styles.iconWrap, live && styles.iconLive)}>
                          <Icon name={it.icon} size={19} />
                        </span>
                        <span className={styles.label}>
                          <span className={styles.itemLabel}>{it.label}</span>
                          <span className={styles.itemHint}>{live ? `Building · ${current?.name ?? '…'}` : it.hint}</span>
                        </span>
                        {it.badge !== undefined && (
                          <span key={it.badge} className={styles.badge}>
                            {it.badge}
                          </span>
                        )}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Live run card */}
          {isBusy && (
            <a
              href="#/studio"
              className={styles.runCard}
              style={stagger()}
              onClick={(e) => {
                e.preventDefault()
                go('studio')
              }}
              data-tip={`Building · ${Math.round(progress * 100)}%`}
            >
              <span className={styles.ring} style={{ ['--p' as string]: progress }} aria-hidden>
                <span>{Math.round(progress * 100)}</span>
              </span>
              <span className={styles.label}>
                <span className={styles.runTitle}>{state.status === 'waiting' ? 'Waiting for you' : `Building ${runScreen?.shared.title || 'screen'}`}</span>
                <span className={styles.runStep}>
                  {current?.name ?? 'Starting'} · step {Math.min(done + 1, STEP_NAMES.length)}/{STEP_NAMES.length}
                </span>
              </span>
            </a>
          )}

          {/* Recent chats */}
          {open && (
            <section className={styles.recent} aria-label="Recent chats">
              <h3 style={stagger()}>
                <span>Recent chats</span>
                {threads.length > 0 && (
                  <button type="button" onClick={() => go('history')}>
                    View all
                  </button>
                )}
              </h3>
              {threads.length === 0 ? (
                <p className={styles.empty} style={stagger()}>
                  <Icon name="message" size={14} /> Conversations are saved here automatically.
                </p>
              ) : (
                <ul>
                  {threads.slice(0, 6).map((t) => (
                    <li key={t.id} style={stagger()}>
                      <button type="button" className={cx(styles.thread, t.id === state.threadId && styles.threadOn)} onClick={() => (p.onOpenThread(t.id), p.onCloseMobile())} disabled={isBusy} title={t.title}>
                        <span className={styles.threadDot} aria-hidden />
                        <span className={styles.threadText}>
                          <span className={styles.threadTitle}>{t.title}</span>
                          <span className={styles.threadMeta}>
                            {t.screens.length} screen{t.screens.length === 1 ? '' : 's'} · {formatRelative(t.updatedAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className={styles.bottom} style={stagger()}>
          <button type="button" className={styles.item} onClick={() => (p.onOpenData(), p.onCloseMobile())} data-tip="Data sources">
            <span className={styles.iconWrap}>
              <Icon name="database" size={19} />
            </span>
            <span className={styles.label}>
              <span className={styles.itemLabel}>Data sources</span>
            </span>
          </button>
          <button type="button" className={styles.item} onClick={() => (p.onOpenSettings(), p.onCloseMobile())} data-tip="Theme & settings">
            <span className={styles.iconWrap}>
              <Icon name="palette" size={19} />
            </span>
            <span className={styles.label}>
              <span className={styles.itemLabel}>Theme & settings</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.modeToggle}
            onClick={() => update({ mode: resolvedMode === 'dark' ? 'light' : 'dark' })}
            aria-label={`Switch to ${resolvedMode === 'dark' ? 'light' : 'dark'} mode`}
            data-tip={resolvedMode === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <span className={cx(styles.modeKnob, resolvedMode === 'dark' && styles.modeDark)} aria-hidden>
              <Icon name={resolvedMode === 'dark' ? 'moon' : 'sun'} size={13} strokeWidth={2.4} />
            </span>
            <span className={styles.label}>
              <span className={styles.itemLabel}>{resolvedMode === 'dark' ? 'Dark' : 'Light'} mode</span>
              <kbd className={styles.kbd}>{MOD}+B</kbd>
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
