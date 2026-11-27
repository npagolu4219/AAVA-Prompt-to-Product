/**
 * Deterministic A2UI → Angular mapper ("Angular Codegen" agent, model tier: deterministic).
 * The LLM decides *what* to build (the A2UI tree); this code decides *how* it is written.
 */
import { isBinding, type A2uiComponent } from '@/types/a2ui'
import type { CollectionBinding, GenFile } from '@/types/run'
import { getAt } from '@/utils/jsonPatch'
import { languageForPath, toKebab, toPascal } from '@/utils/format'

export interface CodegenInput {
  slug: string
  title: string
  components: A2uiComponent[]
  dataModel: Record<string, unknown>
  defects?: string[]
  version: number
  /** Collections imported from the database → generated code fetches them through AavaApiService. */
  bindings?: CollectionBinding[]
  /** action name → route, for actions linked to other screens in the flow. */
  routes?: Record<string, string>
}

interface FormField {
  name: string
  initial: unknown
  validators: string[]
}

const esc = (v: unknown) => String(v ?? '').replace(/"/g, '&quot;')
const str = (v: unknown) => (typeof v === 'string' ? v : '')

const LAYOUT = new Set(['Column', 'Row', 'Grid'])

export function generateAngularFiles(input: CodegenInput): GenFile[] {
  const { slug, components, dataModel } = input
  const byId = new Map(components.map((c) => [c.id, c]))
  const usedComponents = new Set<string>()
  const fields: FormField[] = []
  const handlers = new Map<string, string | null>()
  const classProps: string[] = []
  let usesApi = false
  const routes = input.routes ?? {}

  /** Collection prop: live (signal from the API, seeded) when DB-bound, otherwise a readonly literal. */
  const collection = (node: A2uiComponent, prop: string, suffix: string, value: unknown) => {
    const name = `${node.id}${suffix}`
    const bound = input.bindings?.find((b) => b.componentId === node.id && b.prop === prop)
    const literal = JSON.stringify(value ?? [], null, 2).replace(/\n/g, '\n  ')
    if (bound) {
      usesApi = true
      classProps.push(`  /** Imported from \`${bound.table}\` (${bound.source}); seed used until the API responds. */`)
      classProps.push(`  readonly ${name} = this.api.collection('${bound.table}', ${literal});`)
      return `${name}()`
    }
    classProps.push(`  readonly ${name} = ${literal};`)
    return name
  }

  const fieldFor = (node: A2uiComponent): string => {
    const binding = node.value
    if (!isBinding(binding)) return node.id
    const name = binding.path.split('/').pop() || node.id
    if (!fields.some((f) => f.name === name)) {
      const validators: string[] = []
      if (node.required) validators.push('Validators.required')
      if (node.type === 'email') validators.push('Validators.email')
      fields.push({ name, initial: getAt(dataModel, binding.path) ?? '', validators })
    }
    return name
  }

  const handlerFor = (node: A2uiComponent) => {
    const action = node.action as { event?: { name?: string } } | undefined
    const name = action?.event?.name
    if (!name) return null
    const fn = `on${toPascal(name)}`
    handlers.set(fn, routes[name] ?? null)
    return fn
  }

  const render = (id: string, depth: number): string => {
    const pad = '  '.repeat(depth)
    const n = byId.get(id)
    if (!n) return `${pad}<!-- missing node: ${id} -->`
    const kids = () => (n.children ?? []).map((c) => render(c, depth + 1)).join('\n')
    const tag = toKebab(n.component)
    if (n.component.startsWith('Aava')) usedComponents.add(n.component)

    switch (n.component) {
      case 'Column': {
        const cls = ['stack', n.gap ? `stack--${n.gap}` : '', n.maxWidth ? 'stack--centered' : ''].filter(Boolean).join(' ')
        return `${pad}<div class="${cls}">\n${kids()}\n${pad}</div>`
      }
      case 'Row': {
        const cls = ['cluster', n.justify ? `cluster--${n.justify}` : ''].filter(Boolean).join(' ')
        return `${pad}<div class="${cls}">\n${kids()}\n${pad}</div>`
      }
      case 'Grid':
        return `${pad}<div class="grid grid--${n.columns ?? 2}">\n${kids()}\n${pad}</div>`
      case 'AavaCard': {
        const attrs = [n.title ? ` heading="${esc(n.title)}"` : '', n.subtitle ? ` subheading="${esc(n.subtitle)}"` : ''].join('')
        return `${pad}<aava-card${attrs}>\n${kids()}\n${pad}</aava-card>`
      }
      case 'AavaHeading':
        return `${pad}<aava-heading level="${n.level ?? 1}">${n.text}</aava-heading>`
      case 'AavaText': {
        const attrs = [n.tone ? ` tone="${n.tone}"` : '', n.size ? ` size="${n.size}"` : '', n.weight ? ` weight="${n.weight}"` : '', n.align ? ` align="${n.align}"` : ''].join('')
        return `${pad}<aava-text${attrs}>${n.text}</aava-text>`
      }
      case 'AavaBadge':
        return `${pad}<aava-badge tone="${n.tone ?? 'neutral'}">${n.text}</aava-badge>`
      case 'AavaTextField': {
        const field = fieldFor(n)
        const attrs = [
          n.label ? ` label="${esc(n.label)}"` : '',
          n.hideLabel ? ' hideLabel' : '',
          n.type ? ` type="${n.type}"` : '',
          n.placeholder ? ` placeholder="${esc(n.placeholder)}"` : '',
          n.required ? ' required' : '',
        ].join('')
        return `${pad}<aava-text-field${attrs} formControlName="${field}" />`
      }
      case 'AavaCheckbox':
        return `${pad}<aava-checkbox formControlName="${fieldFor(n)}">${n.label}</aava-checkbox>`
      case 'AavaToggle':
        return `${pad}<aava-toggle formControlName="${fieldFor(n)}" label="${esc(n.label)}" description="${esc(n.description)}" />`
      case 'AavaSelect': {
        const field = fieldFor(n)
        const opts = collection(n, 'options', 'Options', n.options)
        return `${pad}<aava-select label="${esc(n.label)}"${n.hideLabel ? ' hideLabel' : ''} [options]="${opts}" formControlName="${field}" />`
      }
      case 'AavaButton': {
        const fn = handlerFor(n)
        // A primary submit button submits the form (ngSubmit) — no extra (click) or the handler would run twice.
        const submits = n.variant === 'primary' && fn === 'onSubmit' && fields.length > 0
        const attrs = [` variant="${n.variant ?? 'primary'}"`, n.fullWidth ? ' fullWidth' : '', n.icon ? ` icon="${n.icon}"` : '', fn && !submits ? ` (click)="${fn}()"` : ''].join('')
        const type = submits ? ' type="submit"' : ''
        return `${pad}<aava-button${type}${attrs}>${n.label}</aava-button>`
      }
      case 'AavaLink': {
        const fn = handlerFor(n)
        return `${pad}<aava-link${fn ? ` (click)="${fn}()"` : ' href="#"'}>${n.text}</aava-link>`
      }
      case 'AavaDivider':
        return `${pad}<aava-divider${n.label ? ` label="${esc(n.label)}"` : ''} />`
      case 'AavaAvatar':
        return `${pad}<aava-avatar name="${esc(n.name)}" size="lg" />`
      case 'AavaStatCard': {
        const attrs = [` label="${esc(n.label)}"`, ` value="${esc(n.value)}"`, ` delta="${esc(n.delta)}"`, ` trend="${n.trend}"`, ` sentiment="${n.sentiment}"`, n.srLabel ? ` ariaLabel="${esc(n.srLabel)}"` : ''].join('')
        return `${pad}<aava-stat-card class="stat-card"${attrs} />`
      }
      case 'AavaBarChart': {
        const data = collection(n, 'data', 'Data', n.data)
        return `${pad}<aava-bar-chart [data]="${data}" valuePrefix="${esc(n.valuePrefix)}" valueSuffix="${esc(n.valueSuffix)}" />`
      }
      case 'AavaTable': {
        classProps.push(`  readonly ${n.id}Columns = ${JSON.stringify(n.columns ?? [])};`)
        const rows = collection(n, 'rows', 'Rows', n.rows)
        const fn = handlerFor(n)
        return `${pad}<aava-table [columns]="${n.id}Columns" [rows]="${rows}" statusKey="${esc(n.statusKey)}"${fn ? ` (rowClick)="${fn}()"` : ''} />`
      }
      case 'AavaList': {
        const items = collection(n, 'items', 'Items', n.items)
        const fn = handlerFor(n)
        return `${pad}<aava-list variant="${n.variant ?? 'list'}" [items]="${items}"${fn ? ` (itemClick)="${fn}()"` : ''} />`
      }
      default:
        if (LAYOUT.has(n.component)) return kids()
        // Never emit unknown elements — they would not compile under strict templates.
        return `${pad}<!-- ⚠ <${tag}>${n.label ? ` "${esc(n.label)}"` : ''} is not part of the AAVA Play catalog — replace with an approved component -->`
    }
  }

  const body = render('root', fields.length ? 1 : 0)
  const html = fields.length ? `<form class="screen" [formGroup]="form" (ngSubmit)="onSubmit()">\n${body}\n</form>\n` : `<section class="screen">\n${body}\n</section>\n`
  if (fields.length && !handlers.has('onSubmit')) handlers.set('onSubmit', null)

  const className = `${toPascal(slug)}Component`
  const imports = [...usedComponents].sort()
  const navigates = [...handlers.values()].some(Boolean)
  const needsInject = fields.length > 0 || usesApi || navigates
  const tsLines = [
    `// Generated by AAVA Angular Codegen · v${input.version} · deterministic A2UI → Angular mapper`,
    `import { Component${needsInject ? ', inject' : ''} } from '@angular/core';`,
    fields.length ? `import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';` : '',
    navigates ? `import { Router } from '@angular/router';` : '',
    `import { ${imports.join(', ')} } from '@aava/play';`,
    usesApi ? `import { AavaApiService } from '../../core/api.service';` : '',
    '',
    '@Component({',
    `  selector: 'app-${slug}',`,
    `  imports: [${[...imports, ...(fields.length ? ['ReactiveFormsModule'] : [])].join(', ')}],`,
    `  templateUrl: './${slug}.component.html',`,
    `  styleUrl: './${slug}.component.scss',`,
    '})',
    `export class ${className} {`,
    ...(usesApi ? ['  private readonly api = inject(AavaApiService);'] : []),
    ...(navigates ? ['  private readonly router = inject(Router);'] : []),
    ...(fields.length
      ? [
          '  private readonly fb = inject(FormBuilder);',
          '',
          '  readonly form = this.fb.nonNullable.group({',
          ...fields.map((f) => `    ${f.name}: [${JSON.stringify(f.initial)}${f.validators.length ? `, [${f.validators.join(', ')}]` : ''}],`),
          '  });',
          '',
        ]
      : []),
    ...(classProps.length ? [...classProps, ''] : []),
    ...(usesApi || navigates ? [''] : []),
    ...[...handlers].flatMap(([h, route], i) => [
      ...(i > 0 ? [''] : []),
      `  ${h}(): void {`,
      ...(h === 'onSubmit' && fields.length ? ['    if (this.form.invalid) return this.form.markAllAsTouched();'] : []),
      route ? `    void this.router.navigateByUrl('${route}');` : '    // TODO(phase-2): wire to the generated API contract',
      '  }',
    ]),
    '}',
    '',
  ].filter((l, i) => !(l === '' && i < 6))

  const scss = [
    `// Generated by AAVA Angular Codegen · v${input.version}`,
    '// Values come from AAVA Design System tokens (global CSS custom properties) — never hard-code colours or sizes.',
    '',
    ':host { display: block; padding: var(--aava-space-6); }',
    '',
    '.stack { display: flex; flex-direction: column; gap: var(--aava-space-4); }',
    '.stack--xs { gap: var(--aava-space-1); }',
    '.stack--sm { gap: var(--aava-space-2); }',
    '.stack--lg { gap: var(--aava-space-6); }',
    '.stack--centered { max-width: 420px; margin-inline: auto; }',
    '',
    '.cluster { display: flex; flex-wrap: wrap; align-items: center; gap: var(--aava-space-3); }',
    '.cluster--between { justify-content: space-between; }',
    '.cluster--end { justify-content: flex-end; }',
    '',
    '.grid { display: grid; gap: var(--aava-space-4); }',
    '.grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    '.grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }',
    '.grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }',
    '',
    '@media (max-width: 1023.98px) {',
    '  .grid--3, .grid--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    '}',
    '',
    '@media (max-width: 767.98px) {',
    '  :host { padding: var(--aava-space-4); }',
    '  .grid { grid-template-columns: minmax(0, 1fr); }',
    '  .cluster--end aava-button { flex: 1; }',
    '}',
    ...(input.defects?.length ? ['', ...input.defects] : []),
    '',
  ]

  const tsFile = tsLines.join('\n')
  const files: GenFile[] = [
    { path: `${slug}/${slug}.component.ts`, content: tsFile, language: 'typescript' },
    { path: `${slug}/${slug}.component.html`, content: html, language: 'html' },
    { path: `${slug}/${slug}.component.scss`, content: scss.join('\n'), language: 'scss' },
    { path: `verify/${slug}.spec.ts`, content: playwrightSpec(slug, input.title, components), language: 'typescript' },
  ]
  return files.map((f) => ({ ...f, language: languageForPath(f.path) }))
}

function playwrightSpec(slug: string, title: string, components: A2uiComponent[]): string {
  const primary = components.find((c) => c.component === 'AavaButton' && c.variant === 'primary')
  const heading = components.find((c) => c.component === 'AavaHeading')
  return [
    `// Generated by the Playwright Verifier agent — runs on every iteration.`,
    `import { test, expect } from '@playwright/test';`,
    `import AxeBuilder from '@axe-core/playwright';`,
    `import t from './aava-tokens.json';`,
    '',
    `const breakpoints = [375, 768, 1280];`,
    '',
    `test.describe('${title} matches the AAVA spec', () => {`,
    `  for (const width of breakpoints) {`,
    `    test(\`renders at \${width}px\`, async ({ page }) => {`,
    `      await page.setViewportSize({ width, height: 900 });`,
    `      await page.goto('/preview/${slug}');`,
    heading ? `      await expect(page.getByRole('heading', { name: '${str(heading.text)}' })).toBeVisible();` : '',
    primary
      ? [
          `      const cta = page.getByRole('button', { name: '${str(primary.label)}' });`,
          `      // tokens, not magic numbers`,
          `      await expect(cta).toHaveCSS('background-color', t.color.primary.rgb);`,
          `      await expect(cta).toHaveCSS('font-size', t.type.labelMd.size);`,
        ].join('\n')
      : '',
    `      // visual fidelity vs Figma export`,
    `      await expect(page).toHaveScreenshot(\`${slug}-\${width}.png\`, { maxDiffPixelRatio: 0.01 });`,
    `    });`,
    `  }`,
    '',
    `  test('has no WCAG 2.2 AA violations', async ({ page }) => {`,
    `    await page.goto('/preview/${slug}');`,
    `    const r = await new AxeBuilder({ page }).withTags(['wcag2aa', 'wcag22aa']).analyze();`,
    `    expect(r.violations).toEqual([]);`,
    `  });`,
    `});`,
    '',
  ]
    .filter((l) => l !== '')
    .join('\n')
}
