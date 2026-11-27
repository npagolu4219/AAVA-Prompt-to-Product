/**
 * In-browser demo database ("AAVA Demo · PostgreSQL"). Deterministic rows so
 * screenshots and tests are stable. Replace with a real BFF via VITE_DATA_API_URL.
 */
import type { Row, TableSchema } from '@/types/datasource'

const CUSTOMERS = ['Northwind Traders', 'Blue Harbor Co.', 'Lumen Analytics', 'Atlas Freight', 'Kestrel Health', 'Orchard Labs', 'Granite Bank', 'Juniper Retail', 'Solace Energy', 'Vertex Studio', 'Harbor & Pine', 'Quill Legal']
const PEOPLE = ['Priya Raman', 'Daniel Okafor', 'Mei Lin', 'Arjun Mehta', 'Sofia Rossi', 'Liam Walsh', 'Aisha Khan', 'Mateo García', 'Hana Sato', 'Noah Fischer', 'Zara Ahmed', 'Ethan Brooks']
const ORDER_STATUS = ['Paid', 'Pending', 'Paid', 'Refunded', 'Failed', 'Paid', 'Paid', 'Pending']

const pad = (n: number) => String(n).padStart(2, '0')
const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 10, 23 - offset))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const orders: Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: 10482 - i,
  order_no: `#${10482 - i}`,
  customer: CUSTOMERS[i % CUSTOMERS.length],
  amount: Math.round(((i * 7919) % 9700) + 420 + (i % 3) * 0.5 * 100) / 1,
  currency: 'USD',
  status: ORDER_STATUS[i % ORDER_STATUS.length],
  items: (i % 5) + 1,
  created_at: day(Math.floor(i / 2)),
}))

const customers: Row[] = CUSTOMERS.map((name, i) => ({
  id: i + 1,
  name,
  email: `ops@${name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
  plan: ['Enterprise', 'Growth', 'Starter'][i % 3],
  country: ['US', 'UK', 'IN', 'DE', 'JP', 'AU'][i % 6],
  mrr: 1200 + ((i * 1733) % 8800),
  status: i % 7 === 4 ? 'Churned' : 'Active',
}))

const products: Row[] = [
  ['Aurora Desk Lamp', 'Lighting', 89, 42, 4.7, 'New'],
  ['Nimbus Office Chair', 'Furniture', 329, 12, 4.8, 'Bestseller'],
  ['Pebble Wireless Mouse', 'Accessories', 39, 210, 4.4, ''],
  ['Fjord Standing Desk', 'Furniture', 649, 0, 4.9, 'Out of stock'],
  ['Halo Monitor Arm', 'Accessories', 119, 64, 4.6, ''],
  ['Cedar Notebook Set', 'Stationery', 24, 380, 4.5, 'Eco'],
  ['Atlas Laptop Stand', 'Accessories', 59, 96, 4.3, ''],
  ['Lumen Smart Bulb', 'Lighting', 29, 520, 4.2, 'Sale'],
].map(([name, category, price, stock, rating, tag], i) => ({ id: i + 1, sku: `SKU-${1001 + i}`, name, category, price, stock, rating, tag }) as Row)

const users: Row[] = PEOPLE.map((name, i) => ({
  id: i + 1,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@aava.dev`,
  role: ['Admin', 'Designer', 'Engineer', 'Engineer', 'Product Manager', 'QA'][i % 6],
  team: ['Design Systems', 'Platform', 'Commerce', 'Growth'][i % 4],
  status: i % 5 === 3 ? 'Invited' : i % 9 === 7 ? 'Suspended' : 'Active',
  last_active: i % 5 === 3 ? '—' : `${(i % 6) + 1}h ago`,
}))

const revenueWeekly: Row[] = [48.2, 52.9, 50.1, 57.4, 61.8, 59.3, 66.7, 72.4].map((v, i) => ({ week: `W${i + 1}`, revenue_k: v }))

const kpiSnapshot: Row[] = [
  { metric: 'Revenue', value: '$482.6K', delta: '+12.4%', trend: 'up', sentiment: 'positive' },
  { metric: 'Orders', value: '3,918', delta: '+6.1%', trend: 'up', sentiment: 'positive' },
  { metric: 'Avg. order value', value: '$123.18', delta: '−1.8%', trend: 'down', sentiment: 'negative' },
  { metric: 'Churn', value: '2.3%', delta: '−0.4 pts', trend: 'down', sentiment: 'positive' },
]

const notifications: Row[] = [
  ['Run needs approval', 'Sign-in screen v2 is waiting for final sign-off.', 'hitl', '5 min ago', false],
  ['Deployment live', 'aava-portal deployed to preview on Vercel.', 'deploy', '1 h ago', false],
  ['Quality gate passed', 'Revenue dashboard scored 0.95 on iteration 2.', 'quality', '3 h ago', true],
  ['New comment', 'Mei Lin commented on Profile settings spec.', 'comment', 'Yesterday', true],
  ['Catalog updated', 'AAVA Play 1.8 adds AavaStepper and AavaDatePicker.', 'system', '2 days ago', true],
  ['Escalation resolved', 'Checkout contrast issue fixed by Fixer agent.', 'quality', '3 days ago', true],
].map(([title, body, kind, at, read], i) => ({ id: i + 1, title, body, kind, created_at: at, read }) as Row)

const cartItems: Row[] = [
  { id: 1, product: 'Nimbus Office Chair', qty: 1, price: 329 },
  { id: 2, product: 'Halo Monitor Arm', qty: 2, price: 119 },
  { id: 3, product: 'Cedar Notebook Set', qty: 3, price: 24 },
]

const col = (name: string, type: string, pk = false) => ({ name, type, pk })

export const DEMO_TABLES: { schema: TableSchema; rows: Row[] }[] = [
  { schema: { name: 'orders', rowCount: orders.length, description: 'Customer orders', columns: [col('id', 'int4', true), col('order_no', 'text'), col('customer', 'text'), col('amount', 'numeric'), col('currency', 'char(3)'), col('status', 'order_status'), col('items', 'int2'), col('created_at', 'date')] }, rows: orders },
  { schema: { name: 'customers', rowCount: customers.length, description: 'Accounts and plans', columns: [col('id', 'int4', true), col('name', 'text'), col('email', 'text'), col('plan', 'text'), col('country', 'char(2)'), col('mrr', 'numeric'), col('status', 'text')] }, rows: customers },
  { schema: { name: 'products', rowCount: products.length, description: 'Product catalog', columns: [col('id', 'int4', true), col('sku', 'text'), col('name', 'text'), col('category', 'text'), col('price', 'numeric'), col('stock', 'int4'), col('rating', 'numeric'), col('tag', 'text')] }, rows: products },
  { schema: { name: 'users', rowCount: users.length, description: 'Workspace members', columns: [col('id', 'int4', true), col('name', 'text'), col('email', 'text'), col('role', 'text'), col('team', 'text'), col('status', 'text'), col('last_active', 'text')] }, rows: users },
  { schema: { name: 'revenue_weekly', rowCount: revenueWeekly.length, description: 'Weekly revenue (USD k)', columns: [col('week', 'text', true), col('revenue_k', 'numeric')] }, rows: revenueWeekly },
  { schema: { name: 'kpi_snapshot', rowCount: kpiSnapshot.length, description: 'Latest KPI values', columns: [col('metric', 'text', true), col('value', 'text'), col('delta', 'text'), col('trend', 'text'), col('sentiment', 'text')] }, rows: kpiSnapshot },
  { schema: { name: 'notifications', rowCount: notifications.length, description: 'User notifications', columns: [col('id', 'int4', true), col('title', 'text'), col('body', 'text'), col('kind', 'text'), col('created_at', 'text'), col('read', 'bool')] }, rows: notifications },
  { schema: { name: 'cart_items', rowCount: cartItems.length, description: 'Current cart', columns: [col('id', 'int4', true), col('product', 'text'), col('qty', 'int2'), col('price', 'numeric')] }, rows: cartItems },
]

export function demoQuery(table: string, limit: number, columns?: string[]): Row[] {
  const t = DEMO_TABLES.find((x) => x.schema.name === table)
  if (!t) throw new Error(`relation "${table}" does not exist`)
  const rows = t.rows.slice(0, limit)
  return columns?.length ? rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))) : rows.map((r) => ({ ...r }))
}
