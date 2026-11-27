import type { Scenario } from '@/types/scenario'
import { money, str } from './define'

const weekly = [
  { label: 'W1', value: 48.2 },
  { label: 'W2', value: 52.9 },
  { label: 'W3', value: 50.1 },
  { label: 'W4', value: 57.4 },
  { label: 'W5', value: 61.8 },
  { label: 'W6', value: 59.3 },
  { label: 'W7', value: 66.7 },
  { label: 'W8', value: 72.4 },
]

const orders = [
  { order: '#10482', customer: 'Northwind Traders', amount: '$4,820.00', status: 'Paid' },
  { order: '#10481', customer: 'Blue Harbor Co.', amount: '$1,260.50', status: 'Pending' },
  { order: '#10480', customer: 'Lumen Analytics', amount: '$9,410.00', status: 'Paid' },
  { order: '#10479', customer: 'Atlas Freight', amount: '$615.75', status: 'Refunded' },
  { order: '#10478', customer: 'Kestrel Health', amount: '$2,980.00', status: 'Failed' },
  { order: '#10477', customer: 'Orchard Labs', amount: '$3,145.20', status: 'Paid' },
]

export const dashboardScenario: Scenario = {
  id: 'dashboard',
  slug: 'revenue-dashboard',
  title: 'Revenue dashboard',
  keywords: ['dashboard', 'analytics', 'kpi', 'revenue', 'report', 'chart', 'metrics'],
  suggestion: 'Add a revenue dashboard with KPIs and recent orders',
  dataNeeds: [
    {
      table: 'kpi_snapshot',
      limit: 4,
      describe: 'KPI tiles',
      bindings: ['k1', 'k2', 'k3', 'k4'].map((componentId) => ({ componentId, prop: 'props' as const })),
      apply: (rows) =>
        Object.fromEntries(rows.slice(0, 4).map((r, i) => [`k${i + 1}`, { label: str(r.metric), value: str(r.value), delta: str(r.delta), trend: str(r.trend), sentiment: str(r.sentiment) }])),
    },
    {
      table: 'revenue_weekly',
      limit: 8,
      describe: 'weekly revenue series',
      bindings: [{ componentId: 'chart', prop: 'data' }],
      apply: (rows) => ({ chart: { data: rows.map((r) => ({ label: str(r.week), value: Number(r.revenue_k) })) } }),
    },
    {
      table: 'orders',
      limit: 6,
      describe: 'recent orders',
      bindings: [{ componentId: 'table', prop: 'rows' }],
      apply: (rows) => ({
        table: { rows: rows.map((r) => ({ order: str(r.order_no), customer: str(r.customer), amount: money(r.amount), status: str(r.status) })) },
        tableCard: { subtitle: `${rows.length} most recent` },
      }),
    },
  ],
  intent: {
    screenType: 'analytics/dashboard',
    entities: ['kpi.revenue', 'kpi.orders', 'kpi.aov', 'kpi.churn', 'series.weeklyRevenue', 'orders[]'],
    actions: ['export', 'changeRange', 'openOrder'],
    constraints: ['4 KPIs above the fold', 'weekly trend', 'recent orders table', 'responsive grid'],
    tone: 'factual, scannable',
  },
  figma: { frameName: 'Dashboard / Revenue', nodeCount: 318, tokensMapped: 64, tokensFlagged: 3 },
  shortlist: [
    { name: 'AavaStatCard', score: 0.96, why: 'KPI tiles with delta + trend' },
    { name: 'AavaCard', score: 0.94, why: 'Chart + table containers' },
    { name: 'AavaBarChart', score: 0.91, why: 'Weekly revenue trend' },
    { name: 'AavaTable', score: 0.9, why: 'Recent orders with status' },
    { name: 'AavaSelect', score: 0.86, why: 'Date range filter' },
    { name: 'AavaButton', score: 0.84, why: 'Export action' },
    { name: 'AavaHeading', score: 0.82, why: 'Page title' },
  ],
  contextPack: {
    tokens: 3640,
    budget: 4000,
    sources: ['Design Language § Data display', 'DS tokens (colour, space, elevation)', 'Patterns KB: KPI grid', 'Lint rules DS-SPACE-*, DS-COLOR-*'],
  },
  plan: {
    summary: 'Header with title + range filter, a 4-up KPI grid, then a 2-column row: weekly revenue chart and recent orders.',
    items: [
      'Header row: title + "last updated" on the left; range select + Export on the right',
      'KPI grid: 4 columns ≥ 1024px → 2 columns ≥ 600px → 1 column on phones',
      'Chart card (bar chart, 8 weeks) and Orders card (6 rows, status badges) side by side',
      'Stacked single column below 900px; table becomes horizontally scrollable',
      'Loading skeletons for KPIs and chart; empty state for orders',
    ],
  },
  altPlan: {
    summary: 'Revised: chart-first layout with KPIs as a compact strip and orders below.',
    items: ['Compact KPI strip (4 inline stats)', 'Full-width weekly chart', 'Recent orders full width below', 'Single column below 768px'],
  },
  responsive: ['≥ 1024px: KPI grid 4-up, chart + table side by side', '600–1023px: KPI grid 2-up, chart and table stacked', '< 600px: everything single column, table scrolls horizontally'],
  states: ['Loading (skeleton KPIs + chart)', 'Loaded', 'Empty orders', 'Export in progress', 'Data stale warning'],
  components: [
    { id: 'root', component: 'Column', gap: 'lg', children: ['header', 'kpis', 'main'] },
    { id: 'header', component: 'Row', justify: 'between', children: ['titleCol', 'actions'] },
    { id: 'titleCol', component: 'Column', gap: 'sm', children: ['title', 'subtitle'] },
    { id: 'title', component: 'AavaHeading', text: 'Revenue overview', level: 1 },
    { id: 'subtitle', component: 'AavaText', text: 'Last 30 days · updated 5 min ago', tone: 'muted' },
    { id: 'actions', component: 'Row', children: ['range', 'export'] },
    { id: 'range', component: 'AavaSelect', label: 'Range', hideLabel: true, options: ['Last 7 days', 'Last 30 days', 'This quarter'], value: { path: '/filters/range' } },
    { id: 'export', component: 'AavaButton', variant: 'secondary', label: 'Export', icon: 'download', action: { event: { name: 'export' } } },
    { id: 'kpis', component: 'Grid', columns: 4, children: ['k1', 'k2', 'k3', 'k4'] },
    { id: 'k1', component: 'AavaStatCard', label: 'Revenue', value: '$482.6K', delta: '+12.4%', trend: 'up', sentiment: 'positive' },
    { id: 'k2', component: 'AavaStatCard', label: 'Orders', value: '3,918', delta: '+6.1%', trend: 'up', sentiment: 'positive' },
    { id: 'k3', component: 'AavaStatCard', label: 'Avg. order value', value: '$123.18', delta: '−1.8%', trend: 'down', sentiment: 'negative' },
    { id: 'k4', component: 'AavaStatCard', label: 'Churn', value: '2.3%', delta: '−0.4 pts', trend: 'down', sentiment: 'positive' },
    { id: 'main', component: 'Grid', columns: 2, children: ['chartCard', 'tableCard'] },
    { id: 'chartCard', component: 'AavaCard', title: 'Revenue by week', subtitle: 'USD, thousands', children: ['chart'] },
    { id: 'chart', component: 'AavaBarChart', data: weekly, valuePrefix: '$', valueSuffix: 'K' },
    { id: 'tableCard', component: 'AavaCard', title: 'Recent orders', subtitle: '6 of 3,918', children: ['table', 'viewAll'] },
    { id: 'viewAll', component: 'AavaLink', text: 'View all orders →', action: { event: { name: 'viewAllOrders' } } },
    {
      id: 'table',
      component: 'AavaTable',
      columns: [
        { key: 'order', label: 'Order' },
        { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Amount', align: 'end' },
        { key: 'status', label: 'Status' },
      ],
      rows: orders,
      statusKey: 'status',
    },
  ],
  fixes: [
    { id: 'k1', set: { srLabel: 'Revenue up 12.4 percent' }, reason: 'Delta conveyed by colour only' },
    { id: 'k2', set: { srLabel: 'Orders up 6.1 percent' }, reason: 'Delta conveyed by colour only' },
    { id: 'k3', set: { srLabel: 'Average order value down 1.8 percent' }, reason: 'Delta conveyed by colour only' },
    { id: 'k4', set: { srLabel: 'Churn down 0.4 points' }, reason: 'Delta conveyed by colour only' },
  ],
  dataModel: { filters: { range: 'Last 30 days' } },
  defects: ['.stat-card { padding: 18px; } // off the spacing scale', 'th { color: #6b7280; } // raw hex'],
  quality: [
    {
      dims: [0.8, 0.9, 0.85, 0.88, 0.9],
      lintErrors: 1,
      a11yCritical: 0,
      rawColours: 1,
      gaps: [
        { el: '.stat-card', prop: 'padding', found: '18px', expected: '--aava-space-4 (16px)', rule: 'DS-SPACE-01', fix: 'token', severity: 'soft', source: 'lint' },
        { el: 'th', prop: 'color', found: '#6b7280', expected: '--aava-text-muted', rule: 'DS-COLOR-01', fix: 'token', severity: 'hard', source: 'lint' },
        { el: '.kpi-delta', prop: 'aria-label', found: 'colour only', expected: 'text alternative', rule: 'WCAG 1.4.1', fix: 'a11y', severity: 'soft', source: 'critic' },
      ],
    },
    { dims: [0.97, 0.95, 0.93, 0.96, 0.9], lintErrors: 0, a11yCritical: 0, rawColours: 0, gaps: [] },
  ],
}
