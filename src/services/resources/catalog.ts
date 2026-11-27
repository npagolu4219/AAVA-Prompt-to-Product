/**
 * Context resources: per-kind field schema, seeds, and a simulated indexer.
 * In production the BFF clones/reads each source, chunks + embeds it, and the
 * agents retrieve top-k passages. Here indexing is simulated with realistic stats.
 */
import type { IconName } from '@/components/ui/Icon'
import type { Resource, ResourceKind, ResourceStats } from '@/types/resources'

export interface ResourceField {
  key: string
  label: string
  type: 'text' | 'select' | 'secret' | 'textarea'
  options?: string[]
  placeholder?: string
  help?: string
  required?: boolean
  default?: string
}

export interface KindMeta {
  kind: ResourceKind
  label: string
  icon: IconName
  description: string
  fields: ResourceField[]
  /** One-line source description for cards. */
  source: (c: Record<string, string>) => string
}

export const RESOURCE_KINDS: KindMeta[] = [
  {
    kind: 'codebase',
    label: 'Org codebase',
    icon: 'gitBranch',
    description: 'A Git repository the agents search for existing components, services, naming and patterns.',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: ['GitHub', 'GitLab', 'Bitbucket', 'Azure DevOps'], default: 'GitHub' },
      { key: 'url', label: 'Repository URL', type: 'text', placeholder: 'https://github.com/acme/web-portal', required: true },
      { key: 'branch', label: 'Branch', type: 'text', default: 'main' },
      { key: 'paths', label: 'Include paths', type: 'text', default: 'src/app/**', help: 'Comma-separated globs; everything else is ignored.' },
      { key: 'token', label: 'Read-only access token', type: 'secret', help: 'Sent to the indexing service only — never stored in the browser.' },
    ],
    source: (c) => `${c.provider ?? 'Git'} · ${(c.url ?? '').replace(/^https?:\/\/(www\.)?/, '')}@${c.branch || 'main'}`,
  },
  {
    kind: 'figma',
    label: 'Figma library',
    icon: 'figma',
    description: 'A Figma file or team library — components, variables and frames the agents should match.',
    fields: [
      { key: 'url', label: 'Figma file / library URL', type: 'text', placeholder: 'https://www.figma.com/design/…', required: true },
      { key: 'scope', label: 'Use as', type: 'select', options: ['Component library', 'Reference frames', 'Variables (tokens)'], default: 'Component library' },
      { key: 'token', label: 'Personal access token', type: 'secret', help: 'Read-only. Vault only.' },
    ],
    source: (c) => `${c.scope ?? 'Figma'} · ${(c.url ?? '').replace(/^https?:\/\/(www\.)?figma\.com\//, 'figma/')}`,
  },
  {
    kind: 'design-system',
    label: 'Design system docs',
    icon: 'palette',
    description: 'Design language, tokens and component guidelines the critic and planner must follow.',
    fields: [
      { key: 'url', label: 'Docs URL', type: 'text', placeholder: 'https://design.aava.dev', required: true },
      { key: 'version', label: 'Version', type: 'text', default: 'latest' },
    ],
    source: (c) => `${(c.url ?? '').replace(/^https?:\/\//, '')} · ${c.version || 'latest'}`,
  },
  {
    kind: 'openapi',
    label: 'API spec',
    icon: 'api',
    description: 'An OpenAPI/Swagger spec so screens bind to real endpoints and field names.',
    fields: [
      { key: 'url', label: 'OpenAPI URL', type: 'text', placeholder: 'https://api.example.com/openapi.json', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com' },
    ],
    source: (c) => (c.url ?? '').replace(/^https?:\/\//, ''),
  },
  {
    kind: 'docs',
    label: 'Knowledge docs',
    icon: 'book',
    description: 'Product requirements, Confluence/Notion pages or any URL with domain knowledge.',
    fields: [
      { key: 'provider', label: 'Source', type: 'select', options: ['Confluence', 'Notion', 'SharePoint', 'Web page'], default: 'Confluence' },
      { key: 'url', label: 'Space / page URL', type: 'text', placeholder: 'https://acme.atlassian.net/wiki/spaces/PRD', required: true },
    ],
    source: (c) => `${c.provider ?? 'Docs'} · ${(c.url ?? '').replace(/^https?:\/\//, '')}`,
  },
  {
    kind: 'upload',
    label: 'Upload files',
    icon: 'upload',
    description: 'Markdown, text or JSON files (specs, PRDs, style guides) — read in your browser.',
    fields: [],
    source: (c) => c.files ?? 'Uploaded files',
  },
]

export const kindMeta = (k: ResourceKind) => RESOURCE_KINDS.find((m) => m.kind === k)!

export const toHandle = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'resource'

const seed = (r: Omit<Resource, 'status' | 'progress' | 'createdAt'> & Partial<Resource>): Resource => ({ status: 'indexed', progress: 1, createdAt: Date.UTC(2026, 10, 1), indexedAt: Date.UTC(2026, 10, 22, 9), ...r })

export const SEED_RESOURCES: Resource[] = [
  seed({
    id: 'res-aava-play',
    kind: 'design-system',
    name: 'AAVA Design Language',
    handle: 'aava-design',
    enabled: true,
    config: { url: 'https://design.aava.dev', version: '1.8' },
    stats: { files: 64, chunks: 412, tokens: 96_400, highlights: ['48 AAVA Play components', '212 tokens', 'Lint rules DS-*'] },
  }),
  seed({
    id: 'res-web-portal',
    kind: 'codebase',
    name: 'aava/web-portal',
    handle: 'web-portal',
    enabled: true,
    config: { provider: 'GitHub', url: 'https://github.com/aava-engineering/web-portal', branch: 'main', paths: 'src/app/**' },
    stats: { files: 1284, chunks: 6_920, tokens: 1_480_000, highlights: ['Angular 21', '86 components', '23 services', 'Signals + standalone'] },
  }),
  seed({
    id: 'res-figma-kit',
    kind: 'figma',
    name: 'AAVA Product UI Kit',
    handle: 'ui-kit',
    enabled: true,
    config: { url: 'https://www.figma.com/design/Ab12Cd34Ef56/AAVA-Product-UI-Kit', scope: 'Component library' },
    stats: { files: 1, chunks: 318, tokens: 41_200, highlights: ['142 components', '64 variables', '18 pages'] },
  }),
  seed({
    id: 'res-commerce-api',
    kind: 'openapi',
    name: 'Commerce API',
    handle: 'commerce-api',
    enabled: false,
    config: { url: 'https://api.aava.dev/commerce/openapi.json', baseUrl: 'https://api.aava.dev/commerce' },
    stats: { files: 1, chunks: 96, tokens: 18_700, highlights: ['34 endpoints', 'orders · products · customers'] },
  }),
  seed({
    id: 'res-prd',
    kind: 'docs',
    name: 'Prompt-to-Product PRD',
    handle: 'prd',
    enabled: false,
    config: { provider: 'Confluence', url: 'https://aava.atlassian.net/wiki/spaces/P2P' },
    stats: { files: 12, chunks: 140, tokens: 22_300, highlights: ['12 pages', 'Pilot success criteria'] },
  }),
]

/** Deterministic, plausible index stats for a newly-added source. */
export function simulateIndex(r: Resource): { ok: boolean; stats?: ResourceStats; message: string } {
  const url = r.config.url ?? ''
  if (r.kind !== 'upload' && (!/^https?:\/\/\S+\.\S+/.test(url) || /fail|invalid/i.test(url))) return { ok: false, message: `Could not reach ${url || 'source'} — check the URL and access token.` }
  const h = [...(url || r.name)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const pick = (min: number, max: number, salt = 0) => min + ((h >>> salt) % (max - min))
  switch (r.kind) {
    case 'codebase': {
      const files = pick(180, 2400)
      return { ok: true, message: 'Repository indexed', stats: { files, chunks: files * 5, tokens: files * 1100, highlights: [['Angular 21', 'React 19', 'Vue 3'][h % 3], `${pick(20, 140, 3)} components`, `${pick(6, 40, 5)} services`] } }
    }
    case 'figma':
      return { ok: true, message: 'Library synced', stats: { files: 1, chunks: pick(80, 400), tokens: pick(9000, 60000), highlights: [`${pick(30, 200, 2)} components`, `${pick(10, 90, 4)} variables`] } }
    case 'design-system':
      return { ok: true, message: 'Docs crawled', stats: { files: pick(20, 90), chunks: pick(120, 500), tokens: pick(30000, 120000), highlights: [`${pick(20, 60, 2)} component pages`, 'Token tables'] } }
    case 'openapi':
      return { ok: true, message: 'Spec parsed', stats: { files: 1, chunks: pick(30, 140), tokens: pick(6000, 30000), highlights: [`${pick(10, 60, 2)} endpoints`, `${pick(5, 30, 4)} schemas`] } }
    case 'docs':
      return { ok: true, message: 'Pages crawled', stats: { files: pick(4, 40), chunks: pick(40, 300), tokens: pick(8000, 70000), highlights: [`${pick(4, 40, 2)} pages`] } }
    case 'upload': {
      const tokens = Math.ceil((r.content?.length ?? 0) / 4)
      return { ok: true, message: 'Files read locally', stats: { files: Number(r.config.count ?? 1), chunks: Math.max(1, Math.ceil(tokens / 400)), tokens, highlights: [r.config.files ?? ''] } }
    }
  }
}
