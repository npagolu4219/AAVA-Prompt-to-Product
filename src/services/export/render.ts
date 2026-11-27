/** IR → JSX (React), Vue template, or static HTML. Deterministic and dependency-free. */
import type { IRNode, ScreenSeed } from './ir'

type El = Extract<IRNode, { k: 'el' }>

const VOID = new Set(['input', 'img', 'br', 'hr'])

export const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const jsxText = (v: string) => (/[{}<>]/.test(v) ? `{${JSON.stringify(v)}}` : v.replace(/&/g, '&amp;'))

const kebabToCamel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

// ---------------------------------------------------------------------------
// React / JSX
// ---------------------------------------------------------------------------
export function toJsx(node: IRNode, depth: number, keyExpr?: string): string {
  const pad = '  '.repeat(depth)
  if (node.k === 'text') return node.value ? `${pad}${jsxText(node.value)}` : ''
  if (node.k === 'expr') return `${pad}{${node.path}}`
  if (node.k === 'each') {
    const inner = toJsx(node.child, depth + 1, 'i')
    return `${pad}{col.${node.source}.map((${node.item}, i) => (\n${inner}\n${pad}))}`
  }
  const attrs: string[] = []
  if (keyExpr) attrs.push(`key={${keyExpr}}`)
  if (node.dynCls) attrs.push(`className={\`${node.dynCls.base} ${node.dynCls.prefix}\${${node.dynCls.path}}\`}`)
  else if (node.cls) attrs.push(`className="${node.cls}"`)
  for (const [k, v] of Object.entries(node.attrs ?? {})) {
    const name = k === 'for' ? 'htmlFor' : k
    attrs.push(v === true ? name : `${name}="${escapeHtml(v)}"`)
  }
  if (node.style) attrs.push(`style={{ ${Object.entries(node.style).map(([k, v]) => `${kebabToCamel(k)}: '${v}'`).join(', ')} }}`)
  if (node.dynStyle) attrs.push(`style={{ ${node.dynStyle.prop}: \`\${${node.dynStyle.path}}${node.dynStyle.unit}\` }}`)
  if (node.model) {
    const k = JSON.stringify(node.model.key)
    if (node.model.kind === 'checkbox') attrs.push(`checked={Boolean(model[${k}])}`, `onChange={(e) => update(${k}, e.target.checked)}`)
    else attrs.push(`value={String(model[${k}] ?? '')}`, `onChange={(e) => update(${k}, e.target.value)}`)
  }
  if (node.click) attrs.push(`onClick={() => go('${node.click}')}`)
  const open = `<${node.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}`
  const kids = (node.children ?? []).map((c) => toJsx(c, depth + 1)).filter(Boolean)
  let out: string
  if (VOID.has(node.tag) || kids.length === 0) out = `${pad}${open} />`
  else if (kids.length === 1 && !kids[0].includes('\n') && kids[0].trim().length < 60) out = `${pad}${open}>${kids[0].trim()}</${node.tag}>`
  else out = `${pad}${open}>\n${kids.join('\n')}\n${pad}</${node.tag}>`
  return node.when ? `${pad}{${node.when} && (\n${out.replace(/^/gm, '  ')}\n${pad})}` : out
}

// ---------------------------------------------------------------------------
// Vue template
// ---------------------------------------------------------------------------
export function toVue(node: IRNode, depth: number, loop?: { source: string; item: string }): string {
  const pad = '  '.repeat(depth)
  if (node.k === 'text') return node.value ? `${pad}${escapeHtml(node.value)}` : ''
  if (node.k === 'expr') return `${pad}{{ ${node.path} }}`
  if (node.k === 'each') return toVue(node.child, depth, { source: node.source, item: node.item })
  const attrs: string[] = []
  if (loop) attrs.push(`v-for="(${loop.item}, i) in col.${loop.source}"`, ':key="i"')
  if (node.when) attrs.push(`v-if="${node.when}"`)
  if (node.dynCls) attrs.push(`class="${node.dynCls.base}"`, `:class="'${node.dynCls.prefix}' + ${node.dynCls.path}"`)
  else if (node.cls) attrs.push(`class="${node.cls}"`)
  for (const [k, v] of Object.entries(node.attrs ?? {})) attrs.push(v === true ? k : `${k}="${escapeHtml(v)}"`)
  if (node.style) attrs.push(`style="${Object.entries(node.style).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v}`).join('; ')}"`)
  if (node.dynStyle) attrs.push(`:style="{ ${node.dynStyle.prop}: ${node.dynStyle.path} + '${node.dynStyle.unit}' }"`)
  if (node.model) attrs.push(`v-model="model['${node.model.key}']"`)
  if (node.click) attrs.push(`@click="go('${node.click}')"`)
  const open = `<${node.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}`
  const kids = (node.children ?? []).map((c) => toVue(c, depth + 1)).filter(Boolean)
  if (VOID.has(node.tag)) return `${pad}${open} />`
  if (kids.length === 0) return `${pad}${open}></${node.tag}>`
  if (kids.length === 1 && !kids[0].includes('\n') && kids[0].trim().length < 60) return `${pad}${open}>${kids[0].trim()}</${node.tag}>`
  return `${pad}${open}>\n${kids.join('\n')}\n${pad}</${node.tag}>`
}

// ---------------------------------------------------------------------------
// Static HTML (collections expanded from the seed at build time)
// ---------------------------------------------------------------------------
const lookup = (scope: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), scope)

export function toHtml(node: IRNode, depth: number, seed: ScreenSeed, scope: Record<string, unknown> = {}): string {
  const pad = '  '.repeat(depth)
  if (node.k === 'text') return node.value ? `${pad}${escapeHtml(node.value)}` : ''
  if (node.k === 'expr') return `${pad}${escapeHtml(String(lookup(scope, node.path) ?? ''))}`
  if (node.k === 'each') {
    const items = seed.collections[node.source] ?? []
    return items.map((it) => toHtml(node.child, depth, seed, { ...scope, [node.item]: it })).join('\n')
  }
  const n = node as El
  if (n.when && !lookup(scope, n.when)) return ''
  const attrs: string[] = []
  const cls = n.dynCls ? `${n.dynCls.base} ${n.dynCls.prefix}${String(lookup(scope, n.dynCls.path) ?? '')}` : n.cls
  if (cls) attrs.push(`class="${cls}"`)
  for (const [k, v] of Object.entries(n.attrs ?? {})) attrs.push(v === true ? k : `${k}="${escapeHtml(v)}"`)
  const style = [...Object.entries(n.style ?? {}).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v}`), ...(n.dynStyle ? [`${n.dynStyle.prop}: ${lookup(scope, n.dynStyle.path)}${n.dynStyle.unit}`] : [])]
  if (style.length) attrs.push(`style="${style.join('; ')}"`)
  if (n.model) {
    attrs.push(`data-model="${n.model.key}"`)
    const v = seed.model[n.model.key]
    if (n.model.kind === 'checkbox' && v === true) attrs.push('checked')
    if (n.model.kind === 'text' && typeof v === 'string' && v) attrs.push(`value="${escapeHtml(v)}"`)
  }
  if (n.click) attrs.push(`data-action="${n.click}"`)
  if (n.tag === 'option' && n.children?.[0]?.k === 'expr') {
    const val = String(lookup(scope, n.children[0].path) ?? '')
    const parentModel = Object.values(seed.model).includes(val)
    if (parentModel) attrs.push('selected')
  }
  const open = `<${n.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`
  if (VOID.has(n.tag)) return `${pad}${open}`
  const kids = (n.children ?? []).map((c) => toHtml(c, depth + 1, seed, scope)).filter(Boolean)
  if (kids.length === 0) return `${pad}${open}</${n.tag}>`
  if (kids.length === 1 && !kids[0].includes('\n') && kids[0].trim().length < 70) return `${pad}${open}${kids[0].trim()}</${n.tag}>`
  return `${pad}${open}\n${kids.join('\n')}\n${pad}</${n.tag}>`
}
