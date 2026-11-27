import type { ConnectionResult, DataSourceConfig, Row, TableSchema } from '@/types/datasource'
import { DEMO_TABLES, demoQuery } from './mockDatabase'

/**
 * Database access goes through a BFF — the browser never holds DB credentials.
 *  - MockDataSourceClient: in-browser demo database (default)
 *  - HttpDataSourceClient: `VITE_DATA_API_URL` → GET /sources/:id/tables, /sources/:id/tables/:name?limit=
 */
export interface DataSourceClient {
  readonly kind: 'mock' | 'http'
  test(config: DataSourceConfig, password: string): Promise<ConnectionResult>
  listTables(config: DataSourceConfig): Promise<TableSchema[]>
  query(config: DataSourceConfig, table: string, opts: { limit: number; columns?: string[] }): Promise<Row[]>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

class MockDataSourceClient implements DataSourceClient {
  readonly kind = 'mock' as const

  async test(config: DataSourceConfig, password: string): Promise<ConnectionResult> {
    const started = performance.now()
    await wait(450 + Math.random() * 300)
    const latencyMs = Math.round(performance.now() - started)
    if (!config.host.trim() || /fail|invalid|bad/i.test(config.host)) return { ok: false, latencyMs, message: `could not connect to server: Connection refused (${config.host || 'empty host'}:${config.port})` }
    if (!password && config.kind !== 'rest' && config.id !== 'demo') return { ok: false, latencyMs, message: 'password authentication failed for user "' + config.user + '"' }
    return { ok: true, latencyMs, message: `Connected · ${DEMO_TABLES.length} tables visible to ${config.user || 'role'}` }
  }

  async listTables(): Promise<TableSchema[]> {
    await wait(220)
    return DEMO_TABLES.map((t) => t.schema)
  }

  async query(_config: DataSourceConfig, table: string, opts: { limit: number; columns?: string[] }): Promise<Row[]> {
    await wait(180)
    return demoQuery(table, opts.limit, opts.columns)
  }
}

class HttpDataSourceClient implements DataSourceClient {
  readonly kind = 'http' as const
  private readonly base: string
  constructor(base: string) {
    this.base = base.replace(/\/$/, '')
  }

  async test(config: DataSourceConfig, password: string): Promise<ConnectionResult> {
    const started = performance.now()
    const res = await fetch(`${this.base}/sources/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, password }) })
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    return { ok: res.ok, latencyMs: Math.round(performance.now() - started), message: body.message ?? res.statusText }
  }

  async listTables(config: DataSourceConfig): Promise<TableSchema[]> {
    const res = await fetch(`${this.base}/sources/${config.id}/tables`)
    if (!res.ok) throw new Error(`listTables failed: ${res.status}`)
    return res.json()
  }

  async query(config: DataSourceConfig, table: string, opts: { limit: number; columns?: string[] }): Promise<Row[]> {
    const q = new URLSearchParams({ limit: String(opts.limit), ...(opts.columns?.length ? { columns: opts.columns.join(',') } : {}) })
    const res = await fetch(`${this.base}/sources/${config.id}/tables/${encodeURIComponent(table)}?${q}`)
    if (!res.ok) throw new Error(`query failed: ${res.status}`)
    return res.json()
  }
}

const DATA_API_URL: string | undefined = import.meta.env.VITE_DATA_API_URL || undefined

export const dataSourceClient: DataSourceClient = DATA_API_URL ? new HttpDataSourceClient(DATA_API_URL) : new MockDataSourceClient()

export const DEMO_SOURCE: DataSourceConfig = {
  id: 'demo',
  name: 'AAVA Demo DB',
  kind: 'postgres',
  host: 'demo.db.aava.internal',
  port: 5432,
  database: 'aava_demo',
  user: 'readonly_agent',
  ssl: true,
  createdAt: Date.UTC(2026, 10, 1),
  status: 'connected',
}

export const DB_KINDS = [
  { value: 'postgres', label: 'PostgreSQL', port: 5432 },
  { value: 'mysql', label: 'MySQL', port: 3306 },
  { value: 'mssql', label: 'SQL Server', port: 1433 },
  { value: 'mongodb', label: 'MongoDB', port: 27017 },
  { value: 'rest', label: 'REST API', port: 443 },
] as const
