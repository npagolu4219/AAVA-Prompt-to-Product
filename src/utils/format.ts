let counter = 0

/** Short, sortable-ish unique id. */
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const formatScore = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2))

export const formatPercent = (n: number) => `${Math.round(n * 100)}%`

export const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export const formatClock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const formatRelative = (ts: number, now = Date.now()) => {
  const diff = Math.round((now - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  const d = Math.floor(diff / 86400)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export const toPascal = (s: string) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')

export const toKebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export const languageForPath = (path: string) => {
  const ext = path.split('.').pop() ?? ''
  return (
    { ts: 'typescript', tsx: 'typescript', js: 'javascript', html: 'html', scss: 'scss', css: 'css', md: 'markdown', json: 'json' }[ext] ??
    'plaintext'
  )
}

/** Parse a Figma URL into file key + node id (if present). */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  const m = url.match(/figma\.com\/(?:file|design|proto)\/([A-Za-z0-9]+)(?:\/[^?]*)?(?:\?(.*))?/)
  if (!m) return null
  const params = new URLSearchParams(m[2] ?? '')
  const nodeId = params.get('node-id')?.replace('-', ':') ?? undefined
  return { fileKey: m[1], nodeId }
}
