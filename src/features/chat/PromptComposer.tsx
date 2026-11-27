import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useResources } from '@/app/providers/ResourcesProvider'
import { useRun, type StartMode } from '@/app/providers/RunProvider'
import { Button, IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { MAX_SCREENS, PROMPT_SUGGESTIONS, REFINE_SUGGESTIONS } from '@/config/app'
import { BUILT_IN_SCENARIOS, wantsNewScreen } from '@/data/scenarios'
import { kindMeta } from '@/services/resources/catalog'
import { cx, parseFigmaUrl } from '@/utils/format'
import styles from './Chat.module.scss'

const DEMO_FIGMA = 'https://www.figma.com/design/Ab12Cd34Ef56/AAVA-Login?node-id=12-345'

/**
 * Prompt input. Once a screen exists, each prompt either adds a NEW screen to the
 * flow (up to 10) or REFINES the active one — auto-detected, user-overridable.
 */
export function PromptComposer({ onGoContext }: { onGoContext?: () => void }) {
  const { resources, enabled } = useResources()
  // @mention state: the token being typed before the caret.
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const { start, stop, isBusy, state, activeScreen, canAddScreen } = useRun()
  const [prompt, setPrompt] = useState('')
  const [override, setOverride] = useState<StartMode | null>(null)
  const [figmaOpen, setFigmaOpen] = useState(false)
  const [figmaUrl, setFigmaUrl] = useState('')
  const [figmaToken, setFigmaToken] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const built = state.screens.filter((s) => s.surface)
  const hasScreens = built.length > 0 && Boolean(activeScreen?.surface)
  const auto: StartMode = !hasScreens || figmaOpen || wantsNewScreen(prompt) ? 'new' : 'refine'
  const mode: StartMode = !hasScreens ? 'new' : !canAddScreen ? 'refine' : (override ?? auto)

  // "+ Screen" buttons elsewhere ask the composer to switch to new-screen mode.
  useEffect(() => {
    const onCompose = () => {
      setOverride('new')
      inputRef.current?.focus()
    }
    window.addEventListener('aava:compose', onCompose)
    return () => window.removeEventListener('aava:compose', onCompose)
  }, [])

  const usedScenarios = new Set(built.map((s) => s.shared.scenarioId))
  const suggestions = !hasScreens
    ? PROMPT_SUGGESTIONS
    : mode === 'new'
      ? BUILT_IN_SCENARIOS.filter((s) => !usedScenarios.has(s.id)).slice(0, 4).map((s) => s.suggestion)
      : REFINE_SUGGESTIONS.filter((s) => activeScreen?.shared.scenarioId === 'login' || !/SSO/.test(s))

  const figmaValid = !figmaOpen || (Boolean(parseFigmaUrl(figmaUrl)) && figmaToken.trim().length >= 4)
  const canSend = prompt.trim().length > 2 && figmaValid && !isBusy && (mode === 'refine' || canAddScreen)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    start(prompt.trim(), figmaOpen ? { url: figmaUrl.trim(), token: figmaToken.trim() } : undefined, mode)
    setPrompt('')
    setOverride(null)
    setFigmaToken('') // tokens are single-use in the UI
    setFigmaOpen(false)
  }

  const mentionOptions = mention
    ? resources.filter((r) => r.status === 'indexed' && (r.handle.includes(mention.query.toLowerCase()) || r.name.toLowerCase().includes(mention.query.toLowerCase()))).slice(0, 6)
    : []
  const mentioned = [...new Set([...prompt.matchAll(/@([a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase()))].map((h) => resources.find((r) => r.handle === h)).filter((r) => r !== undefined)

  const detectMention = (value: string, caret: number) => {
    const m = value.slice(0, caret).match(/(?:^|\s)@([a-z0-9-]*)$/i)
    setMention(m ? { query: m[1], start: caret - m[1].length - 1 } : null)
    setMentionIdx(0)
  }

  const insertMention = (handle: string) => {
    if (!mention) return
    const el = inputRef.current
    const caret = el?.selectionStart ?? prompt.length
    const next = `${prompt.slice(0, mention.start)}@${handle} ${prompt.slice(caret)}`
    setPrompt(next)
    setMention(null)
    requestAnimationFrame(() => {
      const pos = mention.start + handle.length + 2
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionOptions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + mentionOptions.length) % mentionOptions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionOptions[mentionIdx].handle)
        return
      }
      if (e.key === 'Escape') {
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      {hasScreens && !isBusy && (
        <div className={styles.modeRow}>
          <SegmentedControl<StartMode>
            label="What should this prompt do?"
            size="sm"
            block
            value={mode}
            onChange={setOverride}
            options={[
              { value: 'new', label: canAddScreen ? `New screen ${built.length + 1}/${MAX_SCREENS}` : `Limit ${MAX_SCREENS}/${MAX_SCREENS}`, icon: 'plus' },
              { value: 'refine', label: `Refine · ${activeScreen?.shared.title ?? ''}`, icon: 'edit' },
            ]}
          />
          {override === null && <span className={styles.autoHint}>auto</span>}
        </div>
      )}

      {!isBusy && !prompt && !figmaOpen && suggestions.length > 0 && (
        <div className={styles.suggestions} aria-label={mode === 'refine' && hasScreens ? 'Refinement ideas' : 'Screen ideas'}>
          <span className={styles.suggestLabel}>
            <Icon name="bulb" size={12} />
            {!hasScreens ? 'Try' : mode === 'new' ? 'Next' : 'Refine'}
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.suggestion}
              title={s}
              onClick={() => {
                setPrompt(s)
                if (hasScreens) setOverride(mode)
                inputRef.current?.focus()
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {figmaOpen && (
        <fieldset className={styles.figma}>
          <legend className="sr-only">Figma source</legend>
          <div className={styles.figmaRow}>
            <Icon name="link" size={14} />
            <input className={styles.figmaInput} type="url" inputMode="url" placeholder="https://www.figma.com/design/…?node-id=…" aria-label="Figma frame link" value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} />
            <button type="button" className={styles.demoLink} onClick={() => (setFigmaUrl(DEMO_FIGMA), setFigmaToken('figd_demo_token'))}>
              Use demo
            </button>
          </div>
          <div className={styles.figmaRow}>
            <Icon name="lock" size={14} />
            <input className={styles.figmaInput} type="password" autoComplete="off" placeholder="Personal access token (read-only)" aria-label="Figma personal access token" value={figmaToken} onChange={(e) => setFigmaToken(e.target.value)} />
          </div>
          <p className={styles.figmaHint}>
            <Icon name="shield" size={12} /> Token goes to the vault for this run only — never into chat history, logs or the LLM context.
          </p>
        </fieldset>
      )}

      <div className={cx(styles.inputWrap, isBusy && styles.busy)}>
        {mention && mentionOptions.length > 0 && (
          <ul className={styles.mentions} role="listbox" aria-label="Mention a resource">
            {mentionOptions.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === mentionIdx}>
                <button type="button" className={cx(styles.mention, i === mentionIdx && styles.mentionOn)} onMouseDown={(e) => (e.preventDefault(), insertMention(r.handle))}>
                  <Icon name={kindMeta(r.kind).icon} size={14} />
                  <span className={styles.mentionText}>
                    <strong>@{r.handle}</strong>
                    <span>
                      {r.name} · {kindMeta(r.kind).label}
                    </span>
                  </span>
                  {!r.enabled && <span className={styles.mentionOff}>off</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="prompt" className="sr-only">
          Describe the screen
        </label>
        <textarea
          ref={inputRef}
          id="prompt"
          className={styles.input}
          rows={2}
          placeholder={isBusy ? (state.interrupt ? 'Respond to the approval above to continue…' : 'Agent is working… press Stop to cancel') : !hasScreens ? 'Describe a screen… e.g. “Login screen, AAVA theme, SSO option”' : mode === 'new' ? 'Describe the next screen… e.g. “Add an orders list screen”' : `Refine ${activeScreen?.shared.title}… e.g. “make all buttons full width”`}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            detectMention(e.target.value, e.target.selectionStart)
          }}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          aria-autocomplete="list"
          aria-expanded={Boolean(mention && mentionOptions.length)}
          onKeyDown={onKeyDown}
          disabled={isBusy}
        />
        <div className={styles.inputBar}>
          <IconButton
            icon="figma"
            label={figmaOpen ? 'Remove Figma source' : 'Attach Figma link + token'}
            size="sm"
            className={cx(figmaOpen && styles.figmaActive)}
            onClick={() => setFigmaOpen((v) => !v)}
            disabled={isBusy || mode === 'refine'}
            aria-pressed={figmaOpen}
          />
          {!isBusy && (
            <div className={styles.ctxBar} aria-label="Context for this conversation">
              <button
                type="button"
                className={cx(styles.ctxButton, enabled.length > 0 && styles.ctxButtonOn)}
                onClick={onGoContext}
                title={enabled.length ? `Always-on context: ${enabled.map((r) => r.name).join(', ')} — click to manage` : 'Add codebase, Figma or docs as context'}
              >
                <Icon name="layers" size={13} />
                {enabled.length ? `${enabled.length} context` : 'Add context'}
              </button>
              {mentioned
                .filter((r) => !r.enabled)
                .slice(0, 3)
                .map((r) => (
                  <span key={r.id} className={cx(styles.ctxChip, styles.ctxMention)} title={`${kindMeta(r.kind).label} · mentioned`}>
                    <Icon name={kindMeta(r.kind).icon} size={11} />@{r.handle}
                  </span>
                ))}
            </div>
          )}
          <span className={cx(styles.hint, (isBusy || !prompt) && styles.hintHidden)} aria-hidden>
            ↵ send · ⇧↵ newline
          </span>
          {isBusy ? (
            <Button size="sm" variant="danger" icon="stop" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" size="sm" variant="primary" icon={mode === 'new' && hasScreens ? 'plus' : 'send'} disabled={!canSend}>
              {!hasScreens ? 'Generate' : mode === 'new' ? 'Add screen' : 'Refine'}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
