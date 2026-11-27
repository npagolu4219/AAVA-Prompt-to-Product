export type DbKind = 'postgres' | 'mysql' | 'mssql' | 'mongodb' | 'rest'

export interface DataSourceConfig {
  id: string
  name: string
  kind: DbKind
  host: string
  port: number
  database: string
  user: string
  ssl: boolean
  createdAt: number
  status: 'connected' | 'error' | 'untested'
  /** Never persisted; credentials live in the BFF vault. */
  lastMessage?: string
}

export interface ColumnSchema {
  name: string
  type: string
  pk?: boolean
}

export interface TableSchema {
  name: string
  rowCount: number
  columns: ColumnSchema[]
  description?: string
}

export type Row = Record<string, string | number | boolean | null>

export interface ConnectionResult {
  ok: boolean
  latencyMs: number
  message: string
}
