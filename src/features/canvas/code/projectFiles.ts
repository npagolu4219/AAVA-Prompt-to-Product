import { buildProject } from '@/services/export/stacks'
import type { ExportOptions } from '@/types/export'
import type { ScreenState } from '@/types/project'
import type { GenFile } from '@/types/run'
import type { ThemeSettings } from '@/types/theme'

/** One file in the Code tab, wherever it comes from. */
export interface CodeEntry {
  /** Stable id: `<screenId|shell>::<path>`. */
  key: string
  /** Owning screen, or null for generated app-shell files. */
  screenId: string | null
  /** Path inside the screen's own file list (what edit/select actions use). */
  path: string
  /** Path as it lands in the exported Angular project. */
  display: string
  file: GenFile
  previous?: GenFile
  editable: boolean
  changed: boolean
  edited: boolean
}

export interface CodeGroup {
  id: string
  kind: 'shell' | 'screen'
  screenId: string | null
  index: number
  title: string
  subtitle: string
  entries: CodeEntry[]
}

const SHELL_PREFIXES = ['src/app/app.', 'src/app/services/', 'src/main.ts', 'src/styles/tokens.css', 'src/environments/']

/** Where a screen file lives in the exported project (mirrors services/export/stacks angularProject). */
export const projectPath = (screen: ScreenState, path: string) => {
  const name = path.split('/').pop() ?? path
  return path.startsWith('verify/') ? `e2e/${name}` : `src/app/screens/${screen.slug}/${name}`
}

export const entryKey = (screenId: string | null, path: string) => `${screenId ?? 'shell'}::${path}`

export function screenEntries(screen: ScreenState): CodeEntry[] {
  const prev = screen.shared.previousFiles ?? []
  return screen.shared.files.map((f) => {
    const previous = prev.find((p) => p.path === f.path)
    return {
      key: entryKey(screen.id, f.path),
      screenId: screen.id,
      path: f.path,
      display: projectPath(screen, f.path),
      file: f,
      previous,
      editable: true,
      changed: Boolean(previous && previous.content !== f.content),
      edited: screen.editedPaths.includes(f.path),
    }
  })
}

/**
 * The whole generated project as the Code tab shows it: the app shell (routes, config,
 * bootstrap — regenerated from the current screens, read-only) followed by every built
 * screen's own files (editable) in flow order.
 */
export function buildCodeGroups(screens: ScreenState[], theme: ThemeSettings, projectName: string): CodeGroup[] {
  const built = screens.filter((s) => s.surface && s.shared.files.length)
  if (!built.length) return []

  const opts: ExportOptions = {
    stack: 'angular',
    projectName,
    screenIds: built.map((s) => s.id),
    includeTests: false,
    includeData: true,
    includeDocker: false,
    includeCi: false,
    aavaSource: 'portable',
    apiUrl: '',
    deploy: null,
  }
  const shellFiles = buildProject(opts, built, theme).files.filter((f) => SHELL_PREFIXES.some((p) => f.path.startsWith(p)))

  const shell: CodeGroup = {
    id: 'shell',
    kind: 'shell',
    screenId: null,
    index: 0,
    title: 'App shell',
    subtitle: `${built.length} route${built.length === 1 ? '' : 's'} · config · bootstrap`,
    entries: shellFiles.map((f) => ({ key: entryKey(null, f.path), screenId: null, path: f.path, display: f.path, file: f, editable: false, changed: false, edited: false })),
  }

  return [
    shell,
    ...built.map((s, i) => ({
      id: s.id,
      kind: 'screen' as const,
      screenId: s.id,
      index: i + 1,
      title: s.shared.title || s.slug,
      subtitle: `${s.route} · v${s.shared.version}`,
      entries: screenEntries(s),
    })),
  ]
}

/** Every file of the project for a single ZIP, laid out like the Angular export. */
export function projectZipFiles(groups: CodeGroup[], screens: ScreenState[]): GenFile[] {
  const files = groups.flatMap((g) => g.entries.map((e) => ({ ...e.file, path: e.display })))
  for (const s of screens) {
    if (s.shared.spec && groups.some((g) => g.screenId === s.id)) files.push({ path: `docs/${s.slug}.spec.md`, content: s.shared.spec, language: 'markdown' })
  }
  return files
}
