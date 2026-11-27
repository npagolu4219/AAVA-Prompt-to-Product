import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useDataSources } from '@/app/providers/DataSourceProvider'
import { useResources } from '@/app/providers/ResourcesProvider'
import { Button, IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { FigmaRef } from '@/types/run'
import { cx, parseFigmaUrl } from '@/utils/format'
import { RefineButton, RefineSummary, REFINE_SHORTCUT } from './PromptRefine'
import { usePromptRefiner } from './usePromptRefiner'
import styles from './LandingPage.module.scss'
import refineStyles from './PromptRefine.module.scss'

const EXAMPLES = [
  'A sign-in screen with SSO and remember-me…',
  'A revenue dashboard with KPIs, a weekly chart and recent orders…',
  'A product catalog with category filter and add-product…',
  'A team members page with roles, status and invites…',
  'A checkout with shipping, payment and an order summary…',
]

const DEMO_FIGMA = 'https://www.figma.com/design/Ab12Cd34Ef56/AAVA-Login?node-id=12-345'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: (prompt: string, figma?: FigmaRef) => void
  onOpenData: () => void
}

/** Hero prompt bar: animated gradient border, typewriter placeholder, optional Figma source. */
export function LandingPrompt({ value, onChange, onSubmit, onOpenData }: Props) {
  const { active } = useDataSources()
  const { enabled } = useResources()
  const [figmaOpen, setFigmaOpen] = useState(false)
  const [figmaUrl, setFigmaUrl] = useState('')
  const [figmaToken, setFigmaToken] = useState('')
  const [focused, setFocused] = useState(false)
  const [ph, setPh] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const refiner = usePromptRefiner(value, onChange, { dbName: active?.name ?? null, handles: enabled.map((r) => r.handle) })
  const canRefine = value.trim().length > 2

  // ⌘/Ctrl+I refines with the last-used mode (Enhance by default).
  const onRefineKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i' && canRefine && !refiner.busy) {
      e.preventDefault()
      refiner.refine(refiner.mode ?? 'enhance')
      return true
    }
    return false
  }

  // Typewriter placeholder that cycles through example prompts while the field is empty.
  useEffect(() => {
    if (value) return
    let ex = 0
    let i = 0
    let dir = 1
    const t = setInterval(() => {
      const full = EXAMPLES[ex]
      i += dir
      if (i > full.length + 18) dir = -1
      if (i <= 0 && dir === -1) {
        dir = 1
        ex = (ex + 1) % EXAMPLES.length
      }
      setPh(full.slice(0, Math.max(0, Math.min(i, full.length))))
    }, 45)
    return () => clearInterval(t)
  }, [value])

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  const figmaValid = !figmaOpen || (Boolean(parseFigmaUrl(figmaUrl)) && figmaToken.trim().length >= 4)
  const canSend = value.trim().length > 2 && figmaValid && !refiner.busy

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    refiner.dismiss()
    onSubmit(value.trim(), figmaOpen ? { url: figmaUrl.trim(), token: figmaToken.trim() } : undefined)
  }

  return (
    <form className={styles.promptWrap} onSubmit={submit}>
      <div className={cx(styles.prompt, focused && styles.promptFocus)}>
        <label htmlFor="landing-prompt" className="sr-only">
          Describe the screen you want to build
        </label>
        <div className={cx(refineStyles.field, refiner.phase === 'thinking' && refineStyles.fieldThinking, refiner.phase === 'streaming' && refineStyles.fieldStreaming)}>
        <textarea
          ref={ref}
          readOnly={refiner.busy}
          aria-busy={refiner.busy}
          id="landing-prompt"
          className={styles.promptInput}
          rows={3}
          value={value}
          placeholder={ph || 'Describe a screen, a flow or paste a Figma link…'}
          onChange={(e) => {
            onChange(e.target.value)
            // Hand-editing after a refine keeps the text but retires the summary.
            if (refiner.phase === 'done') refiner.dismiss()
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (onRefineKey(e)) return
            if (e.key === 'Escape' && refiner.busy) return refiner.cancel()
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
          <span className={refineStyles.scan} aria-hidden />
        </div>

        {refiner.result && refiner.phase !== 'thinking' && (
          <RefineSummary
            result={refiner.result}
            phase={refiner.phase}
            onUndo={refiner.undo}
            onAgain={() => refiner.refine(refiner.result!.mode)}
            onDismiss={refiner.dismiss}
          />
        )}

        {figmaOpen && (
          <div className={styles.figma}>
            <div className={styles.figmaRow}>
              <Icon name="link" size={14} />
              <input type="url" inputMode="url" placeholder="https://www.figma.com/design/…?node-id=…" aria-label="Figma frame link" value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} />
              <button type="button" className={styles.linkBtn} onClick={() => (setFigmaUrl(DEMO_FIGMA), setFigmaToken('figd_demo_token'))}>
                Use demo
              </button>
            </div>
            <div className={styles.figmaRow}>
              <Icon name="lock" size={14} />
              <input type="password" autoComplete="off" placeholder="Personal access token (read-only · vault only)" aria-label="Figma personal access token" value={figmaToken} onChange={(e) => setFigmaToken(e.target.value)} />
            </div>
          </div>
        )}

        <div className={styles.promptBar}>
          <IconButton icon="figma" size="sm" label={figmaOpen ? 'Remove Figma source' : 'Attach Figma frame'} className={cx(figmaOpen && styles.on)} onClick={() => setFigmaOpen((v) => !v)} aria-pressed={figmaOpen} />
          <RefineButton phase={refiner.phase} mode={refiner.mode} disabled={!canRefine} onRefine={refiner.refine} onCancel={refiner.cancel} />
          <button type="button" className={cx(styles.dbChip, active && styles.dbOn)} onClick={onOpenData} title="Data sources">
            <Icon name="database" size={13} />
            <span>{active ? active.name : 'No database'}</span>
          </button>
          <a className={cx(styles.dbChip, enabled.length > 0 && styles.ctxOn)} href="#/resources" title="Context resources (codebase, Figma, docs)">
            <Icon name="layers" size={13} />
            <span>{enabled.length} context</span>
          </a>
          <span className={styles.kbd}>
            <kbd>{REFINE_SHORTCUT}</kbd> refine · <kbd>Enter</kbd> generate
          </span>
          <Button type="submit" variant="primary" icon="sparkles" disabled={!canSend} className={styles.go}>
            Generate
          </Button>
        </div>
      </div>
    </form>
  )
}
