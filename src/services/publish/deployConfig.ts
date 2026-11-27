/**
 * Provider deployment configuration: field schema per cloud, the config files each one needs
 * (vercel.json, netlify.toml, amplify.yml / GitHub Actions, staticwebapp.config.json, Cloud Run),
 * and the equivalent CLI commands. Secrets are never written into files.
 */
import type { CloudProvider, StackId } from '@/types/export'
import type { GenFile } from '@/types/run'
import { languageForPath } from '@/utils/format'

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'select' | 'secret' | 'number'
  options?: string[]
  placeholder?: string
  help?: string
  default: string
  required?: boolean
}

export interface EnvVar {
  key: string
  value: string
}

export interface DeployConfig {
  provider: CloudProvider
  values: Record<string, string>
  envVars: EnvVar[]
}

export const PROVIDER_FIELDS: Record<CloudProvider, ConfigField[]> = {
  vercel: [
    { key: 'scope', label: 'Team / scope', type: 'text', placeholder: 'aava-engineering', default: 'aava-engineering', help: 'Vercel team slug (vercel --scope).' },
    { key: 'project', label: 'Project name', type: 'text', default: 'aava-portal', required: true },
    { key: 'region', label: 'Function region', type: 'select', options: ['iad1', 'fra1', 'bom1', 'sfo1', 'hnd1', 'syd1'], default: 'iad1' },
    { key: 'node', label: 'Node.js version', type: 'select', options: ['22.x', '20.x'], default: '22.x' },
    { key: 'token', label: 'Access token', type: 'secret', default: '', help: 'vercel.com/account/tokens — sent to the deploy service only, never stored.' },
  ],
  netlify: [
    { key: 'site', label: 'Site name', type: 'text', default: 'aava-portal', required: true, help: 'Becomes <site>.netlify.app' },
    { key: 'team', label: 'Team slug', type: 'text', default: 'aava-engineering' },
    { key: 'node', label: 'Node.js version', type: 'select', options: ['22', '20'], default: '22' },
    { key: 'token', label: 'Personal access token', type: 'secret', default: '', help: 'User settings → Applications. Never stored.' },
  ],
  aws: [
    { key: 'hosting', label: 'Hosting', type: 'select', options: ['S3 + CloudFront', 'Amplify Hosting'], default: 'S3 + CloudFront' },
    { key: 'region', label: 'AWS region', type: 'select', options: ['us-east-1', 'eu-west-1', 'ap-south-1', 'ap-southeast-2'], default: 'us-east-1' },
    { key: 'bucket', label: 'S3 bucket', type: 'text', default: 'aava-portal-web', help: 'S3 + CloudFront only.' },
    { key: 'distribution', label: 'CloudFront distribution ID', type: 'text', placeholder: 'E2ABCDEF123456', default: '', help: 'S3 + CloudFront only — used for cache invalidation.' },
    { key: 'appId', label: 'Amplify app ID', type: 'text', placeholder: 'd1a2b3c4d5e6f7', default: '', help: 'Amplify Hosting only.' },
    { key: 'roleArn', label: 'Deploy role ARN (GitHub OIDC)', type: 'text', placeholder: 'arn:aws:iam::123456789012:role/aava-deploy', default: '', help: 'Preferred over long-lived access keys.' },
  ],
  azure: [
    { key: 'subscription', label: 'Subscription ID', type: 'text', placeholder: '00000000-0000-0000-0000-000000000000', default: '' },
    { key: 'resourceGroup', label: 'Resource group', type: 'text', default: 'rg-aava-web' },
    { key: 'app', label: 'Static Web App name', type: 'text', default: 'aava-portal', required: true },
    { key: 'region', label: 'Region', type: 'select', options: ['eastus2', 'westeurope', 'centralus', 'eastasia', 'westus2'], default: 'eastus2' },
    { key: 'sku', label: 'Plan', type: 'select', options: ['Free', 'Standard'], default: 'Free' },
    { key: 'token', label: 'Deployment token', type: 'secret', default: '', help: 'Static Web App → Manage deployment token. Never stored.' },
  ],
  gcp: [
    { key: 'projectId', label: 'GCP project ID', type: 'text', default: 'aava-prod', required: true },
    { key: 'region', label: 'Region', type: 'select', options: ['us-central1', 'europe-west1', 'asia-south1', 'australia-southeast1'], default: 'us-central1' },
    { key: 'service', label: 'Cloud Run service', type: 'text', default: 'aava-portal', required: true },
    { key: 'memory', label: 'Memory', type: 'select', options: ['256Mi', '512Mi', '1Gi'], default: '256Mi' },
    { key: 'minInstances', label: 'Min instances', type: 'number', default: '0' },
    { key: 'maxInstances', label: 'Max instances', type: 'number', default: '3' },
    { key: 'public', label: 'Allow unauthenticated', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'serviceAccount', label: 'Runtime service account', type: 'text', placeholder: 'web@aava-prod.iam.gserviceaccount.com', default: '' },
  ],
}

export const defaultValues = (p: CloudProvider) => Object.fromEntries(PROVIDER_FIELDS[p].map((f) => [f.key, f.default]))

export const secretKeys = (p: CloudProvider) => PROVIDER_FIELDS[p].filter((f) => f.type === 'secret').map((f) => f.key)

/** Build facts per stack — shared by every provider. */
export function buildFacts(stack: StackId, projectName: string) {
  switch (stack) {
    case 'angular':
      return { install: 'npm ci', build: 'npm run build', output: `dist/${projectName}/browser`, framework: 'angular', envPrefix: '' }
    case 'react':
    case 'vue':
      return { install: 'npm ci', build: 'npm run build', output: 'dist', framework: 'vite', envPrefix: 'VITE_' }
    case 'html':
      return { install: 'npm ci', build: '', output: '.', framework: null as string | null, envPrefix: '' }
  }
}

/** Name of the public env var the generated app reads its data API URL from. */
export const apiEnvKey = (stack: StackId) => (stack === 'react' || stack === 'vue' ? 'VITE_API_URL' : 'API_URL')

const f = (path: string, content: string): GenFile => ({ path, content, language: languageForPath(path) })
const j = (v: unknown) => JSON.stringify(v, null, 2) + '\n'

export interface GeneratedDeploy {
  files: GenFile[]
  commands: string[]
  summary: string
}

export function generateDeployConfig(cfg: DeployConfig, stack: StackId, projectName: string, environment: 'preview' | 'production'): GeneratedDeploy {
  const v = { ...defaultValues(cfg.provider), ...cfg.values }
  const b = buildFacts(stack, projectName)
  const env = cfg.envVars.filter((e) => e.key.trim())
  const prod = environment === 'production'
  const cacheHeader = { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }

  switch (cfg.provider) {
    case 'vercel': {
      const config = {
        $schema: 'https://openapi.vercel.sh/vercel.json',
        framework: b.framework,
        installCommand: b.install,
        buildCommand: b.build || null,
        outputDirectory: b.output,
        regions: [v.region],
        cleanUrls: true,
        rewrites: stack === 'html' ? [] : [{ source: '/(.*)', destination: '/index.html' }],
        headers: [{ source: '/assets/(.*)', headers: [cacheHeader] }],
      }
      return {
        files: [f('vercel.json', j(config))],
        commands: [
          'npm i -g vercel',
          `vercel link --yes --project ${v.project}${v.scope ? ` --scope ${v.scope}` : ''}`,
          ...env.map((e) => `printf '%s' "${e.value}" | vercel env add ${e.key} ${prod ? 'production' : 'preview'}`),
          `vercel deploy${prod ? ' --prod' : ''} --token "$VERCEL_TOKEN"`,
        ],
        summary: `Vercel · ${b.framework ?? 'static'} preset · build "${b.build || '—'}" → ${b.output} · Node ${v.node} · ${v.region}`,
      }
    }
    case 'netlify': {
      const toml = [
        '[build]',
        `  command = "${b.build}"`,
        `  publish = "${b.output}"`,
        '',
        '[build.environment]',
        `  NODE_VERSION = "${v.node}"`,
        ...env.map((e) => `  ${e.key} = "${e.value}"`),
        '',
        ...(stack === 'html' ? [] : ['[[redirects]]', '  from = "/*"', '  to = "/index.html"', '  status = 200', '']),
        '[[headers]]',
        '  for = "/assets/*"',
        '  [headers.values]',
        `    Cache-Control = "${cacheHeader.value}"`,
        '',
      ].join('\n')
      return {
        files: [f('netlify.toml', toml)],
        commands: ['npm i -g netlify-cli', `netlify link --name ${v.site}`, `netlify deploy --build${prod ? ' --prod' : ''} --auth "$NETLIFY_AUTH_TOKEN"`],
        summary: `Netlify · ${v.site}.netlify.app · build "${b.build || '—'}" → ${b.output} · Node ${v.node}`,
      }
    }
    case 'aws': {
      if (v.hosting === 'Amplify Hosting') {
        const yml = [
          'version: 1',
          'frontend:',
          '  phases:',
          '    preBuild:',
          '      commands:',
          `        - ${b.install}`,
          '    build:',
          '      commands:',
          `        - ${b.build || 'echo "static site — no build"'}`,
          '  artifacts:',
          `    baseDirectory: ${b.output}`,
          '    files:',
          "      - '**/*'",
          '  cache:',
          '    paths:',
          "      - 'node_modules/**/*'",
          '',
        ].join('\n')
        return {
          files: [f('amplify.yml', yml), f('amplify/redirects.json', j([{ source: '</^[^.]+$|\\.(?!(css|js|json|png|svg|ico|woff2?)$)([^.]+$)/>', target: '/index.html', status: '200' }]))],
          commands: [
            `aws amplify update-app --app-id ${v.appId || '<APP_ID>'} --region ${v.region} --custom-rules file://amplify/redirects.json`,
            ...(env.length ? [`aws amplify update-branch --app-id ${v.appId || '<APP_ID>'} --branch-name ${prod ? 'main' : 'preview'} --environment-variables ${env.map((e) => `${e.key}=${e.value}`).join(',')} --region ${v.region}`] : []),
            `aws amplify start-job --app-id ${v.appId || '<APP_ID>'} --branch-name ${prod ? 'main' : 'preview'} --job-type RELEASE --region ${v.region}`,
          ],
          summary: `AWS Amplify Hosting · ${v.region} · build "${b.build || '—'}" → ${b.output}`,
        }
      }
      const workflow = [
        'name: Deploy to S3 + CloudFront',
        'on:',
        '  push:',
        `    branches: [${prod ? 'main' : 'preview'}]`,
        'permissions:',
        '  id-token: write',
        '  contents: read',
        'jobs:',
        '  deploy:',
        '    runs-on: ubuntu-latest',
        ...(env.length ? ['    env:', ...env.map((e) => `      ${e.key}: ${e.value}`)] : []),
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 22',
        '          cache: npm',
        `      - run: ${b.install}`,
        ...(b.build ? [`      - run: ${b.build}`] : []),
        '      - uses: aws-actions/configure-aws-credentials@v4',
        '        with:',
        `          role-to-assume: ${v.roleArn || '<DEPLOY_ROLE_ARN>'}`,
        `          aws-region: ${v.region}`,
        `      - run: aws s3 sync ${b.output} s3://${v.bucket} --delete --exclude ".git/*" --exclude "node_modules/*" --cache-control "public,max-age=31536000,immutable" --exclude "index.html"`,
        `      - run: aws s3 cp ${b.output}/index.html s3://${v.bucket}/index.html --cache-control "no-cache"`,
        `      - run: aws cloudfront create-invalidation --distribution-id ${v.distribution || '<DISTRIBUTION_ID>'} --paths "/*"`,
        '',
      ].join('\n')
      return {
        files: [f('.github/workflows/deploy-aws.yml', workflow), f('infra/cloudfront-spa-error-responses.json', j({ Quantity: 2, Items: [403, 404].map((code) => ({ ErrorCode: code, ResponsePagePath: '/index.html', ResponseCode: '200', ErrorCachingMinTTL: 0 })) }))],
        commands: [
          `${b.install} && ${b.build || 'true'}`,
          `aws s3 sync ${b.output} s3://${v.bucket} --delete --region ${v.region}`,
          `aws cloudfront create-invalidation --distribution-id ${v.distribution || '<DISTRIBUTION_ID>'} --paths "/*"`,
        ],
        summary: `AWS S3 (${v.bucket}) + CloudFront · ${v.region} · OIDC role deploy`,
      }
    }
    case 'azure': {
      const swa = {
        navigationFallback: { rewrite: '/index.html', exclude: ['/assets/*', '/*.{css,js,json,png,svg,ico,woff2}'] },
        globalHeaders: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' },
        routes: [{ route: '/assets/*', headers: { 'Cache-Control': cacheHeader.value } }],
      }
      const workflow = [
        'name: Azure Static Web Apps',
        'on:',
        '  push:',
        '    branches: [main]',
        '  pull_request:',
        '    types: [opened, synchronize, reopened]',
        'jobs:',
        '  build_and_deploy:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: Azure/static-web-apps-deploy@v1',
        '        with:',
        '          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}',
        '          action: upload',
        "          app_location: '/'",
        `          output_location: '${b.output === '.' ? '' : b.output}'`,
        `          app_build_command: '${b.build}'`,
        ...(env.length ? ['        env:', ...env.map((e) => `          ${e.key}: ${e.value}`)] : []),
        '',
      ].join('\n')
      return {
        files: [f('staticwebapp.config.json', j(swa)), f('.github/workflows/azure-static-web-apps.yml', workflow)],
        commands: [
          `az staticwebapp create --name ${v.app} --resource-group ${v.resourceGroup} --location ${v.region} --sku ${v.sku}${v.subscription ? ` --subscription ${v.subscription}` : ''}`,
          ...(env.length ? [`az staticwebapp appsettings set --name ${v.app} --setting-names ${env.map((e) => `${e.key}=${e.value}`).join(' ')}`] : []),
          `${b.install} && ${b.build || 'true'}`,
          `npx @azure/static-web-apps-cli deploy ${b.output} --deployment-token "$SWA_TOKEN" --env ${prod ? 'production' : 'preview'}`,
        ],
        summary: `Azure Static Web Apps · ${v.app} (${v.sku}) · ${v.region} · output ${b.output}`,
      }
    }
    case 'gcp': {
      const dockerfile = b.build
        ? `FROM node:22-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN ${b.install}\nCOPY . .\n${env.map((e) => `ENV ${e.key}=${e.value}`).join('\n')}${env.length ? '\n' : ''}RUN ${b.build}\n\nFROM nginx:1.27-alpine\nCOPY deploy/nginx.cloudrun.conf /etc/nginx/conf.d/default.conf\nCOPY --from=build /app/${b.output} /usr/share/nginx/html\nEXPOSE 8080\n`
        : `FROM nginx:1.27-alpine\nCOPY deploy/nginx.cloudrun.conf /etc/nginx/conf.d/default.conf\nCOPY . /usr/share/nginx/html\nEXPOSE 8080\n`
      const nginx = `server {\n  listen 8080;\n  root /usr/share/nginx/html;\n  index index.html;\n  location /assets/ {\n    add_header Cache-Control "${cacheHeader.value}";\n  }\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n`
      const deployArgs = `--region ${v.region} --project ${v.projectId} --memory ${v.memory} --min-instances ${v.minInstances} --max-instances ${v.maxInstances} --port 8080 ${v.public === 'yes' ? '--allow-unauthenticated' : '--no-allow-unauthenticated'}${v.serviceAccount ? ` --service-account ${v.serviceAccount}` : ''}`
      const cloudbuild = [
        'steps:',
        "  - name: 'gcr.io/cloud-builders/docker'",
        `    args: ['build', '-f', 'deploy/Dockerfile.cloudrun', '-t', '${v.region}-docker.pkg.dev/${v.projectId}/web/${v.service}:$SHORT_SHA', '.']`,
        "  - name: 'gcr.io/cloud-builders/docker'",
        `    args: ['push', '${v.region}-docker.pkg.dev/${v.projectId}/web/${v.service}:$SHORT_SHA']`,
        "  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'",
        "    entrypoint: gcloud",
        `    args: ['run', 'deploy', '${v.service}', '--image', '${v.region}-docker.pkg.dev/${v.projectId}/web/${v.service}:$SHORT_SHA', ${deployArgs.split(' ').map((a) => `'${a}'`).join(', ')}]`,
        '',
      ].join('\n')
      return {
        files: [f('deploy/Dockerfile.cloudrun', dockerfile), f('deploy/nginx.cloudrun.conf', nginx), f('cloudbuild.yaml', cloudbuild)],
        commands: [`gcloud config set project ${v.projectId}`, `gcloud builds submit --config cloudbuild.yaml --substitutions SHORT_SHA=$(date +%s)`, `# or, from source: gcloud run deploy ${v.service} --source . ${deployArgs}`],
        summary: `Cloud Run · ${v.service} · ${v.region} · ${v.memory} · ${v.minInstances}–${v.maxInstances} instances`,
      }
    }
  }
}
