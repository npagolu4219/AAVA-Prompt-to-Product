import { DiffEditor, Editor, type BeforeMount } from '@monaco-editor/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { useIsMobile } from '@/hooks'
import { downloadZip } from '@/services/export/zipExport'
import { cx } from '@/utils/format'
import { buildCodeGroups, entryKey, projectZipFiles, type CodeEntry, type CodeGroup } from './projectFiles'
import styles from './CodePane.module.scss'

type Scope = 'project' | 'screen'

const PROJECT_NAME = 'aava-prompt-to-product-app'
const fileName = (p: string) => p.split('/').pop() ?? p
const folderOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.')
const LANG_TONE: Record<string, string> = { typescript: 'ts', html: 'html', scss: 'scss', css: 'scss', markdown: 'md', json: 'md' }
const tone = (lang: string) => LANG_TONE[lang] ?? 'md'
const extLabel = (e: CodeEntry) => fileName(e.display).split('.').pop()?.slice(0, 4) ?? 'txt'
const lines = (s: string) => s.split('\n').length

/** Generated files import @angular/* and @aava/play, which don't exist in the browser — keep syntax checks, drop module resolution errors. */
const configureMonaco: BeforeMount = (monaco) => {
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false })
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({ experimentalDecorators: true, target: monaco.languages.typescript.ScriptTarget.ES2022 })
}

/**
 * Generated code in Monaco.
 *  All screens — the whole Angular project: app shell (routes/config, read-only, regenerated
 *  from the flow) + every screen's files (editable), in flow order.
 *  This screen — only the active screen's files.
 * Edit-back, diff vs the previous version, copy, and ZIP for either scope.
 */
export function CodePane() {
  const { state, activeScreen, editFile, selectFile } = useRun()
  const { settings, resolvedMode } = useTheme()
  const notify = useToast()
  const isMobile = useIsMobile()
  const [diff, setDiff] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const groups = useMemo(() => buildCodeGroups(state.screens, settings, PROJECT_NAME), [state.screens, settings])
  const screenGroups = groups.filter((g) => g.kind === 'screen')
  const [scopePref, setScopePref] = useState<Scope | null>(null)
  const scope: Scope = scopePref ?? (screenGroups.length > 1 ? 'project' : 'screen')

  const activeGroup = groups.find((g) => g.screenId === activeScreen?.id)
  const visibleGroups: CodeGroup[] = scope === 'project' ? groups : activeGroup ? [activeGroup] : []
  const all = visibleGroups.flatMap((g) => g.entries)

  // Selection: explicit pick, else the active screen's remembered file, else the first file.
  const [picked, setPicked] = useState<string | null>(null)
  const fallbackKey = activeScreen?.activeFile ? entryKey(activeScreen.id, activeScreen.activeFile) : null
  const active = all.find((e) => e.key === picked) ?? all.find((e) => e.key === fallbackKey) ?? activeGroup?.entries[0] ?? all[0]
  const owner = groups.find((g) => g.entries.some((e) => e.key === active?.key))

  // Picking a screen in the strip jumps the tree to that screen's file.
  const lastScreen = useRef(activeScreen?.id)
  useEffect(() => {
    if (lastScreen.current === activeScreen?.id) return
    lastScreen.current = activeScreen?.id
    setPicked(null)
    if (activeScreen) setCollapsed((c) => (c.has(activeScreen.id) ? new Set([...c].filter((x) => x !== activeScreen.id)) : c))
  }, [activeScreen])

  const treeRef = useRef<HTMLElement>(null)
  useEffect(() => {
    treeRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active?.key, scope])

  if (!active) {
    return <EmptyState icon="code" title="No code yet" description="Angular files are compiled deterministically from the A2UI tree — no LLM tokens are spent writing boilerplate." />
  }

  const pick = (e: CodeEntry) => {
    setPicked(e.key)
    if (e.screenId) selectFile(e.path, e.screenId)
    if (!e.previous) setDiff(false)
  }

  const q = query.trim().toLowerCase()
  const match = (g: CodeGroup, e: CodeEntry) => !q || e.display.toLowerCase().includes(q) || g.title.toLowerCase().includes(q)
  const toggle = (id: string) => setCollapsed((c) => (c.has(id) ? new Set([...c].filter((x) => x !== id)) : new Set([...c, id])))

  const totalFiles = all.length
  const totalLines = all.reduce((n, e) => n + lines(e.file.content), 0)
  const monacoTheme = resolvedMode === 'dark' ? 'vs-dark' : 'light'
  const options = {
    minimap: { enabled: false },
    fontSize: isMobile ? 12 : 13,
    fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
    scrollBeyondLastLine: false,
    wordWrap: (isMobile ? 'on' : 'off') as 'on' | 'off',
    lineNumbers: (isMobile ? 'off' : 'on') as 'on' | 'off',
    renderLineHighlight: 'line' as const,
    padding: { top: 12 },
    automaticLayout: true,
    tabSize: 2,
    readOnly: !active.editable,
  }
  const showDiff = diff && Boolean(active.previous)
  const monacoPath = `${active.screenId ?? 'shell'}/${active.display}`

  const onZip = async () => {
    setZipping(true)
    try {
      if (scope === 'project') {
        const files = projectZipFiles(groups, state.screens).map((f) => ({ ...f, path: `${PROJECT_NAME}/${f.path}` }))
        await downloadZip(files, [], `${PROJECT_NAME}-code`)
        notify(`ZIP downloaded · ${screenGroups.length} screens, ${files.length} files`, 'success')
      } else if (activeScreen) {
        const { slug } = activeScreen
        const { files, spec, version } = activeScreen.shared
        await downloadZip(files, spec ? [{ path: `${slug}/${slug}.spec.md`, content: spec, language: 'markdown' }] : [], `${slug}-v${version}`)
        notify('ZIP downloaded', 'success')
      }
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className={styles.pane}>
      <aside ref={treeRef} className={styles.tree} aria-label="Generated files">
        <div className={styles.treeHead}>
          <div className={styles.scope} role="radiogroup" aria-label="Code scope">
            <button type="button" role="radio" aria-checked={scope === 'project'} className={cx(scope === 'project' && styles.scopeOn)} onClick={() => setScopePref('project')}>
              All screens <span className={styles.count}>{screenGroups.length}</span>
            </button>
            <button type="button" role="radio" aria-checked={scope === 'screen'} className={cx(scope === 'screen' && styles.scopeOn)} onClick={() => setScopePref('screen')} disabled={!activeGroup}>
              This screen
            </button>
            <span className={styles.scopeThumb} style={{ transform: scope === 'screen' ? 'translateX(100%)' : undefined }} aria-hidden />
          </div>
          {!isMobile && (
            <label className={styles.search}>
              <Icon name="search" size={13} />
              <span className="sr-only">Filter files</span>
              <input type="search" placeholder="Filter files…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
        </div>

        {isMobile ? (
          <label className={styles.mobilePicker}>
            <Icon name="file" size={14} />
            <span className="sr-only">File</span>
            <select value={active.key} onChange={(e) => pick(all.find((x) => x.key === e.target.value)!)}>
              {visibleGroups.map((g) => (
                <optgroup key={g.id} label={g.kind === 'shell' ? 'App shell' : `${g.index}. ${g.title}`}>
                  {g.entries.map((f) => (
                    <option key={f.key} value={f.key}>
                      {scope === 'project' ? fileName(f.display) : f.path}
                      {f.changed ? ' •' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Icon name="chevronDown" size={14} />
          </label>
        ) : scope === 'project' ? (
          <div className={styles.groups}>
            {groups.map((g, gi) => {
              const entries = g.entries.filter((e) => match(g, e))
              if (!entries.length) return null
              const open = Boolean(q) || !collapsed.has(g.id)
              const current = g.screenId !== null && g.screenId === activeScreen?.id
              return (
                <section key={g.id} className={cx(styles.screenGroup, current && styles.screenCurrent)} style={{ ['--i' as string]: gi } as CSSProperties}>
                  <button type="button" className={styles.screenHead} onClick={() => toggle(g.id)} aria-expanded={open}>
                    <Icon name="chevronRight" size={12} className={cx(styles.chev, open && styles.chevOpen)} />
                    <span className={cx(styles.screenNum, g.kind === 'shell' && styles.shellNum)}>{g.kind === 'shell' ? <Icon name="layers" size={11} /> : g.index}</span>
                    <span className={styles.screenText}>
                      <strong>{g.title}</strong>
                      <span>{g.subtitle}</span>
                    </span>
                    <span className={styles.screenCount}>{entries.length}</span>
                  </button>
                  {open && (
                    <ul className={styles.fileList}>
                      {entries.map((f) => (
                        <FileRow key={f.key} entry={f} label={fileName(f.display)} hint={g.kind === 'shell' ? folderOf(f.display) : undefined} active={f.key === active.key} onPick={pick} />
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <FolderTree entries={all.filter((e) => match(activeGroup!, e))} activeKey={active.key} onPick={pick} />
        )}
      </aside>

      <section className={styles.editorCol}>
        <div className={styles.toolbar}>
          {owner && (
            <span className={cx(styles.crumb, owner.kind === 'shell' && styles.crumbShell)} title={owner.title}>
              {owner.kind === 'shell' ? <Icon name="layers" size={12} /> : <span className={styles.crumbNum}>{owner.index}</span>}
              <span>{owner.title}</span>
            </span>
          )}
          <span className={styles.path} title={scope === 'project' ? active.display : active.path}>
            <Icon name="chevronRight" size={12} />
            <span>{fileName(active.display)}</span>
          </span>
          {!active.editable && (
            <Badge size="sm" tone="info">
              read-only
            </Badge>
          )}
          {showDiff && activeScreen && (
            <Badge size="sm" tone="accent">
              previous → current
            </Badge>
          )}
          <span className={styles.spacer} />
          <Button size="sm" variant={showDiff ? 'primary' : 'ghost'} icon="diff" disabled={!active.previous} onClick={() => setDiff((v) => !v)} aria-pressed={showDiff} title={active.previous ? 'Compare with previous version' : 'No previous version yet'}>
            <span className={styles.hideXs}>Diff</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="copy"
            onClick={() => {
              void navigator.clipboard?.writeText(active.file.content)
              notify(`Copied ${fileName(active.display)}`, 'success')
            }}
          >
            <span className={styles.hideXs}>Copy</span>
          </Button>
          <Button size="sm" variant="primary" icon="download" loading={zipping} onClick={onZip} title={scope === 'project' ? 'Download every screen + app shell' : 'Download this screen'}>
            ZIP{scope === 'project' ? <span className={styles.hideXs}>&nbsp;all</span> : null}
          </Button>
        </div>

        <div className={styles.editor}>
          {showDiff && active.previous ? (
            <DiffEditor
              key={`diff-${monacoPath}`}
              original={active.previous.content}
              modified={active.file.content}
              language={active.file.language}
              theme={monacoTheme}
              options={{ ...options, readOnly: true, renderSideBySide: !isMobile }}
              beforeMount={configureMonaco}
              loading={<EditorLoading />}
            />
          ) : (
            <Editor
              // One editor instance per file: switching path+value on a live instance can push the new
              // file's text into the previous model (and its onChange), corrupting that file.
              key={monacoPath}
              path={monacoPath}
              value={active.file.content}
              language={active.file.language}
              theme={monacoTheme}
              options={options}
              onChange={(v, ev) => {
                if (!active.editable || !active.screenId || v === undefined || ev.isFlush) return
                editFile(active.path, v, active.screenId)
              }}
              beforeMount={configureMonaco}
              loading={<EditorLoading />}
            />
          )}
        </div>
        <div className={styles.status}>
          {active.editable ? 'Editable · edits stay in this workspace and ship on export' : 'Generated from the flow · regenerates when screens or links change'} · {lines(active.file.content)} lines
          {scope === 'project' && (
            <>
              {' '}
              · project: {screenGroups.length} screens, {totalFiles} files, {totalLines.toLocaleString()} lines
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function FileRow({ entry, label, hint, active, onPick }: { entry: CodeEntry; label: string; hint?: string; active: boolean; onPick: (e: CodeEntry) => void }) {
  return (
    <li>
      <button type="button" className={cx(styles.file, active && styles.activeFile)} onClick={() => onPick(entry)} aria-current={active || undefined} title={entry.display}>
        <span className={cx(styles.ext, styles[tone(entry.file.language)])}>{extLabel(entry)}</span>
        <span className={styles.fname}>
          {label}
          {hint && <small>{hint}</small>}
        </span>
        {entry.edited && <span className={styles.editedDot} title="Edited by hand" />}
        {entry.changed && <span className={styles.changed} title="Changed since previous version" />}
      </button>
    </li>
  )
}

function FolderTree({ entries, activeKey, onPick }: { entries: CodeEntry[]; activeKey: string; onPick: (e: CodeEntry) => void }) {
  const folders = new Map<string, CodeEntry[]>()
  for (const e of entries) folders.set(folderOf(e.path), [...(folders.get(folderOf(e.path)) ?? []), e])
  return (
    <>
      {[...folders].map(([folder, files]) => (
        <div key={folder} className={styles.group}>
          <div className={styles.folder}>
            <Icon name="folder" size={14} /> {folder}/
          </div>
          <ul>
            {files.map((f) => (
              <FileRow key={f.key} entry={f} label={fileName(f.path)} active={f.key === activeKey} onPick={onPick} />
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

function EditorLoading() {
  return (
    <div className={styles.loading}>
      <span className={styles.spinner} aria-hidden /> Loading editor…
    </div>
  )
}
