export type StackId = 'angular' | 'react' | 'vue' | 'html'

export interface ExportOptions {
  stack: StackId
  projectName: string
  screenIds: string[]
  includeTests: boolean
  includeData: boolean
  includeDocker: boolean
  includeCi: boolean
  /** Angular only: portable local kit (installs from public npm) or the internal @aava/play registry. */
  aavaSource: 'portable' | 'registry'
  /** Data API base URL baked into the build (empty → seed data). */
  apiUrl: string
  /** Optional provider config files (vercel.json, netlify.toml, …). */
  deploy: import('@/services/publish/deployConfig').DeployConfig | null
}

export type FindingSeverity = 'error' | 'warning' | 'info'

export interface Finding {
  severity: FindingSeverity
  rule: string
  message: string
  file?: string
  line?: number
}

export interface CodeAnalysis {
  files: number
  loc: number
  bytes: number
  byLanguage: { language: string; files: number; loc: number }[]
  dependencies: { name: string; version: string; dev: boolean }[]
  routes: { path: string; title: string }[]
  components: { name: string; count: number }[]
  bindings: number
  findings: Finding[]
  counts: Record<FindingSeverity, number>
}

export type CloudProvider = 'vercel' | 'netlify' | 'aws' | 'azure' | 'gcp'

export interface Deployment {
  id: string
  provider: CloudProvider
  stack: StackId
  environment: 'preview' | 'production'
  projectName: string
  url: string
  status: 'live' | 'failed'
  screens: number
  sizeKb: number
  createdAt: number
  simulated: boolean
}

export interface DeployLog {
  at: number
  stage: string
  message: string
  level: 'info' | 'success' | 'warn' | 'error'
}
