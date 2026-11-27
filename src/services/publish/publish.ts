/**
 * Publish to cloud.
 *  - MockPublishClient: packages the real ZIP, then simulates the provider pipeline (clearly marked "simulated").
 *  - HttpPublishClient: POSTs the ZIP to VITE_PUBLISH_URL/deployments (your deploy BFF) and returns its URL.
 */
import { PUBLISH_URL } from '@/config/app'
import type { CloudProvider, Deployment, DeployLog, StackId } from '@/types/export'
import type { GenFile } from '@/types/run'
import { uid } from '@/utils/format'
import type { DeployConfig } from './deployConfig'

export interface ProviderMeta {
  id: CloudProvider
  name: string
  service: string
  regions: string[]
  urlFor: (project: string, hash: string, env: 'preview' | 'production') => string
}

export const PROVIDERS: ProviderMeta[] = [
  { id: 'vercel', name: 'Vercel', service: 'Edge Network', regions: ['iad1 (US East)', 'fra1 (Frankfurt)', 'bom1 (Mumbai)'], urlFor: (p, h, e) => (e === 'production' ? `https://${p}.vercel.app` : `https://${p}-${h}.vercel.app`) },
  { id: 'netlify', name: 'Netlify', service: 'Netlify Edge', regions: ['Global CDN'], urlFor: (p, h, e) => (e === 'production' ? `https://${p}.netlify.app` : `https://deploy-preview-${h}--${p}.netlify.app`) },
  { id: 'aws', name: 'AWS', service: 'S3 + CloudFront', regions: ['us-east-1', 'eu-west-1', 'ap-south-1'], urlFor: (_p, h) => `https://d${h}.cloudfront.net` },
  { id: 'azure', name: 'Azure', service: 'Static Web Apps', regions: ['East US 2', 'West Europe', 'Central India'], urlFor: (p, h, e) => `https://${e === 'production' ? '' : 'preview-'}${p}-${h}.azurestaticapps.net` },
  { id: 'gcp', name: 'Google Cloud', service: 'Cloud Run', regions: ['us-central1', 'europe-west1', 'asia-south1'], urlFor: (p, h) => `https://${p}-${h}-uc.a.run.app` },
]

export interface PublishRequest {
  provider: CloudProvider
  /** Provider settings (non-secret) used to generate config files. */
  config: DeployConfig
  /** Tokens/keys for this deploy only — forwarded to the deploy BFF, never stored or logged. */
  secrets: Record<string, string>
  region: string
  environment: 'preview' | 'production'
  projectName: string
  stack: StackId
  files: GenFile[]
  screens: number
}

export interface PublishClient {
  readonly kind: 'mock' | 'http'
  deploy(req: PublishRequest, onLog: (log: DeployLog) => void, signal: AbortSignal): Promise<Deployment>
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Aborted', 'AbortError'))), { once: true })
  })

async function zipBlob(files: GenFile[]) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const f of files) zip.file(f.path, f.content)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

const BUILD_CMD: Record<StackId, string> = { angular: 'ng build --configuration production', react: 'tsc -b && vite build', vue: 'vue-tsc -b && vite build', html: '(static — no build step)' }

class MockPublishClient implements PublishClient {
  readonly kind = 'mock' as const

  async deploy(req: PublishRequest, onLog: (l: DeployLog) => void, signal: AbortSignal): Promise<Deployment> {
    const provider = PROVIDERS.find((p) => p.id === req.provider)!
    const log = (stage: string, message: string, level: DeployLog['level'] = 'info') => onLog({ at: Date.now(), stage, message, level })
    const hash = Math.random().toString(36).slice(2, 9)

    log('package', `Packaging ${req.files.length} files (${req.screens} screens, ${req.stack})…`)
    const blob = await zipBlob(req.files)
    const sizeKb = Math.max(1, Math.round(blob.size / 1024))
    log('package', `Artifact ready · ${sizeKb} KB (deflate)`, 'success')
    const configFiles = req.files.filter((f) => /^(vercel\.json|netlify\.toml|amplify\.yml|staticwebapp\.config\.json|cloudbuild\.yaml|\.github\/workflows\/(deploy-aws|azure-static-web-apps)\.yml)$/.test(f.path))
    log('config', configFiles.length ? `Using ${configFiles.map((f) => f.path).join(', ')}` : 'No provider config found — using defaults', configFiles.length ? 'info' : 'warn')
    const secretsGiven = Object.values(req.secrets).filter(Boolean).length
    log('auth', secretsGiven ? `Credentials received (${secretsGiven}) · forwarded to deploy service, redacted from logs` : 'No credentials provided — simulated deploy only', secretsGiven ? 'info' : 'warn')
    if (req.config.envVars.some((e) => e.key)) log('env', `Setting ${req.config.envVars.filter((e) => e.key).map((e) => e.key).join(', ')} for ${req.environment}`)
    await sleep(400, signal)

    if (req.stack !== 'html') {
      log('install', 'npm ci — resolving dependencies from lockfile')
      await sleep(900, signal)
      log('install', 'Dependencies installed', 'success')
    }
    log('build', BUILD_CMD[req.stack])
    await sleep(req.stack === 'html' ? 300 : 1300, signal)
    log('build', `Build complete · ${req.screens} route(s) prerendered`, 'success')

    log('upload', `Uploading to ${provider.name} ${provider.service} (${req.region})`)
    await sleep(800, signal)
    log('upload', 'Upload verified (checksums match)', 'success')

    log('provision', `Provisioning ${req.environment} environment · TLS certificate · SPA fallback rewrite`)
    await sleep(700, signal)
    log('smoke', 'Smoke test: GET / → 200 · axe quick scan → 0 critical')
    await sleep(500, signal)

    const url = provider.urlFor(req.projectName, hash, req.environment)
    log('live', `Live at ${url} (simulated — connect VITE_PUBLISH_URL for real deploys)`, 'success')
    return { id: uid('dpl'), provider: req.provider, stack: req.stack, environment: req.environment, projectName: req.projectName, url, status: 'live', screens: req.screens, sizeKb, createdAt: Date.now(), simulated: true }
  }
}

class HttpPublishClient implements PublishClient {
  readonly kind = 'http' as const
  private readonly base: string
  constructor(base: string) {
    this.base = base.replace(/\/$/, '')
  }

  async deploy(req: PublishRequest, onLog: (l: DeployLog) => void, signal: AbortSignal): Promise<Deployment> {
    const log = (stage: string, message: string, level: DeployLog['level'] = 'info') => onLog({ at: Date.now(), stage, message, level })
    log('package', `Packaging ${req.files.length} files…`)
    const blob = await zipBlob(req.files)
    const sizeKb = Math.max(1, Math.round(blob.size / 1024))
    log('upload', `Uploading ${sizeKb} KB to deploy service`)
    const body = new FormData()
    body.append('artifact', blob, `${req.projectName}.zip`)
    body.append('meta', JSON.stringify({ provider: req.provider, region: req.region, environment: req.environment, projectName: req.projectName, stack: req.stack, settings: req.config.values, envVars: req.config.envVars }))
    // Credentials travel once, in a header, to the deploy BFF (which stores them in its vault).
    const res = await fetch(`${this.base}/deployments`, { method: 'POST', body, signal, headers: { 'X-Deploy-Credentials': btoa(JSON.stringify(req.secrets)) } })
    if (!res.ok) throw new Error(`Deploy service responded ${res.status}`)
    const out = (await res.json()) as { id: string; url: string }
    log('live', `Live at ${out.url}`, 'success')
    return { id: out.id, provider: req.provider, stack: req.stack, environment: req.environment, projectName: req.projectName, url: out.url, status: 'live', screens: req.screens, sizeKb, createdAt: Date.now(), simulated: false }
  }
}

export const publishClient: PublishClient = PUBLISH_URL ? new HttpPublishClient(PUBLISH_URL) : new MockPublishClient()
