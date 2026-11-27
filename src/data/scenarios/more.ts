/**
 * Seven more screens so one conversation can build a complete 10-screen product flow.
 * Data-heavy screens declare `dataNeeds` — the agent imports those rows from the connected DB.
 */
import type { Scenario } from '@/types/scenario'
import { c, defineScenario, money, str } from './define'

const STATUS_TONE: Record<string, string> = { Active: 'success', Invited: 'warning', Suspended: 'danger', New: 'primary', Bestseller: 'success', Sale: 'warning', Eco: 'success', 'Out of stock': 'danger' }

export const signupScenario: Scenario = defineScenario({
  id: 'signup',
  slug: 'sign-up',
  title: 'Create account',
  suggestion: 'Add a sign-up screen',
  keywords: ['sign up', 'signup', 'register', 'registration', 'create account', 'onboarding'],
  intent: { screenType: 'authentication/register', entities: ['user.firstName', 'user.lastName', 'user.email', 'user.password', 'company.size'], actions: ['register', 'sso', 'signIn'], constraints: ['password rules visible', 'terms consent'] },
  plan: {
    summary: 'Centred card with a two-column name row, email + password, company size, consent and a primary "Create account" action.',
    items: ['Heading + value statement', 'First / last name side by side (stacked < 768px)', 'Email, password with rules hint', 'Company size select · terms checkbox', 'Primary CTA → divider → SSO · link back to sign in'],
  },
  components: [
    c('root', 'Column', { align: 'center', maxWidth: 480 }, ['card']),
    c('card', 'AavaCard', {}, ['title', 'subtitle', 'names', 'email', 'password', 'hint', 'size', 'terms', 'cta', 'divider', 'sso', 'signin']),
    c('title', 'AavaHeading', { text: 'Create your account', level: 1 }),
    c('subtitle', 'AavaText', { text: 'Start building on-brand screens in minutes.', tone: 'muted' }),
    c('names', 'Grid', { columns: 2 }, ['first', 'last']),
    c('first', 'AavaTextField', { label: 'First name', required: true, value: { path: '/user/firstName' } }),
    c('last', 'AavaTextField', { label: 'Last name', required: true, value: { path: '/user/lastName' } }),
    c('email', 'AavaTextField', { label: 'Work email', type: 'email', required: true, placeholder: 'name@company.com', value: { path: '/user/email' } }),
    c('password', 'AavaTextField', { label: 'Password', type: 'password', required: true, value: { path: '/user/password' } }),
    c('hint', 'AavaText', { text: 'At least 12 characters, one number and one symbol.', tone: 'subtle', size: 'sm' }),
    c('size', 'AavaSelect', { label: 'Company size', options: ['1–10', '11–50', '51–200', '201–1000', '1000+'], value: { path: '/company/size' } }),
    c('terms', 'AavaCheckbox', { label: 'I agree to the Terms and Privacy Policy', value: { path: '/user/terms' } }),
    c('cta', 'AavaButton', { variant: 'primary', label: 'Create account', fullWidth: true, action: { event: { name: 'register' } } }),
    c('divider', 'AavaDivider', { label: 'or' }),
    c('sso', 'AavaButton', { variant: 'secondary', label: 'Sign up with SSO', icon: 'key', fullWidth: true, action: { event: { name: 'sso' } } }),
    c('signin', 'AavaLink', { text: 'Already have an account? Sign in', action: { event: { name: 'signIn' } } }),
  ],
  dataModel: { user: { firstName: '', lastName: '', email: '', password: '', terms: false }, company: { size: '11–50' } },
})

export const forgotScenario: Scenario = defineScenario({
  id: 'forgot-password',
  slug: 'forgot-password',
  title: 'Reset password',
  suggestion: 'Add a forgot-password screen',
  keywords: ['forgot', 'reset password', 'recover', 'recovery', 'forgot password'],
  intent: { screenType: 'authentication/recovery', entities: ['user.email'], actions: ['sendLink', 'backToSignIn'], constraints: ['single field', 'no account enumeration'] },
  plan: {
    summary: 'Minimal centred card: one email field, one primary action and a way back to sign in.',
    items: ['Heading + reassurance copy', 'Email field', 'Primary "Send reset link" full width', 'Neutral success message (no account enumeration)', 'Link back to sign in'],
  },
  components: [
    c('root', 'Column', { align: 'center', maxWidth: 420 }, ['card']),
    c('card', 'AavaCard', {}, ['badge', 'title', 'subtitle', 'email', 'cta', 'back']),
    c('badge', 'AavaBadge', { text: 'Account recovery', tone: 'brand' }),
    c('title', 'AavaHeading', { text: 'Reset your password', level: 1 }),
    c('subtitle', 'AavaText', { text: 'Enter your work email. If an account exists, we’ll send a secure link valid for 30 minutes.', tone: 'muted' }),
    c('email', 'AavaTextField', { label: 'Work email', type: 'email', required: true, placeholder: 'name@company.com', value: { path: '/user/email' } }),
    c('cta', 'AavaButton', { variant: 'primary', label: 'Send reset link', fullWidth: true, action: { event: { name: 'sendLink' } } }),
    c('back', 'AavaLink', { text: '← Back to sign in', action: { event: { name: 'backToSignIn' } } }),
  ],
  dataModel: { user: { email: '' } },
})

export const ordersScenario: Scenario = defineScenario({
  id: 'orders',
  slug: 'orders',
  title: 'Orders',
  suggestion: 'Add an orders list screen',
  keywords: ['orders', 'order list', 'order history', 'transactions', 'purchases'],
  intent: { screenType: 'commerce/order-list', entities: ['orders[]'], actions: ['search', 'filter', 'export', 'openOrder'], constraints: ['10 rows per page', 'status filter', 'responsive table'] },
  plan: {
    summary: 'Header with search, status filter and export, then a full-width orders table imported from the database.',
    items: ['Title + count', 'Toolbar: search field, status select, Export', 'Orders table: number, customer, date, items, amount, status badge', 'Horizontal scroll on phones'],
  },
  components: [
    c('root', 'Column', { gap: 'lg' }, ['header', 'toolbar', 'tableCard']),
    c('header', 'Column', { gap: 'sm' }, ['title', 'subtitle']),
    c('title', 'AavaHeading', { text: 'Orders', level: 1 }),
    c('subtitle', 'AavaText', { text: 'Track, filter and export customer orders.', tone: 'muted' }),
    c('toolbar', 'Row', { justify: 'between' }, ['search', 'filters']),
    c('search', 'AavaTextField', { label: 'Search orders', hideLabel: true, placeholder: 'Search by order or customer…', value: { path: '/filters/q' } }),
    c('filters', 'Row', {}, ['status', 'export']),
    c('status', 'AavaSelect', { label: 'Status', hideLabel: true, options: ['All statuses', 'Paid', 'Pending', 'Refunded', 'Failed'], value: { path: '/filters/status' } }),
    c('export', 'AavaButton', { variant: 'secondary', label: 'Export CSV', icon: 'download', action: { event: { name: 'export' } } }),
    c('tableCard', 'AavaCard', { title: 'All orders', subtitle: 'Loading…' }, ['table']),
    c('table', 'AavaTable', {
      columns: [
        { key: 'order', label: 'Order' },
        { key: 'customer', label: 'Customer' },
        { key: 'date', label: 'Date' },
        { key: 'items', label: 'Items', align: 'end' },
        { key: 'amount', label: 'Amount', align: 'end' },
        { key: 'status', label: 'Status' },
      ],
      rows: [],
      statusKey: 'status',
      action: { event: { name: 'openOrder' } },
    }),
  ],
  dataModel: { filters: { q: '', status: 'All statuses' } },
  dataNeeds: [
    {
      table: 'orders',
      limit: 10,
      describe: 'orders',
      bindings: [{ componentId: 'table', prop: 'rows' }],
      apply: (rows) => ({
        table: { rows: rows.map((r) => ({ order: str(r.order_no), customer: str(r.customer), date: str(r.created_at), items: str(r.items), amount: money(r.amount), status: str(r.status) })) },
        tableCard: { subtitle: `${rows.length} orders · imported from orders` },
      }),
    },
  ],
})

export const productsScenario: Scenario = defineScenario({
  id: 'products',
  slug: 'products',
  title: 'Product catalog',
  suggestion: 'Add a product catalog screen',
  keywords: ['product', 'products', 'catalog', 'catalogue', 'shop', 'store', 'inventory'],
  intent: { screenType: 'commerce/catalog', entities: ['products[]'], actions: ['filter', 'addProduct', 'openProduct'], constraints: ['card grid', '4 → 2 → 1 columns'] },
  plan: {
    summary: 'Catalog header with category filter and "Add product", then a responsive grid of product cards from the products table.',
    items: ['Title + item count', 'Category select + primary "Add product"', 'Product cards: name, category, price, stock, tag badge', 'Grid 4 → 2 → 1 columns'],
  },
  components: [
    c('root', 'Column', { gap: 'lg' }, ['header', 'grid']),
    c('header', 'Row', { justify: 'between' }, ['titleCol', 'actions']),
    c('titleCol', 'Column', { gap: 'sm' }, ['title', 'subtitle']),
    c('title', 'AavaHeading', { text: 'Product catalog', level: 1 }),
    c('subtitle', 'AavaText', { text: 'Loading products…', tone: 'muted' }),
    c('actions', 'Row', {}, ['category', 'add']),
    c('category', 'AavaSelect', { label: 'Category', hideLabel: true, options: ['All categories'], value: { path: '/filters/category' } }),
    c('add', 'AavaButton', { variant: 'primary', label: 'Add product', icon: 'plus', action: { event: { name: 'addProduct' } } }),
    c('grid', 'AavaList', { variant: 'grid', items: [], action: { event: { name: 'openProduct' } } }),
  ],
  dataModel: { filters: { category: 'All categories' } },
  dataNeeds: [
    {
      table: 'products',
      limit: 8,
      describe: 'products',
      bindings: [
        { componentId: 'grid', prop: 'items' },
        { componentId: 'category', prop: 'options' },
      ],
      apply: (rows) => ({
        grid: {
          items: rows.map((r) => ({
            title: str(r.name),
            subtitle: str(r.category),
            meta: `${money(r.price)} · ${Number(r.stock) > 0 ? `${r.stock} in stock` : 'Out of stock'} · ★ ${r.rating}`,
            badge: str(r.tag) || undefined,
            tone: STATUS_TONE[str(r.tag)] ?? 'neutral',
          })),
        },
        category: { options: ['All categories', ...new Set(rows.map((r) => str(r.category)))] },
        subtitle: { text: `${rows.length} products · synced from products table` },
      }),
    },
  ],
})

export const teamScenario: Scenario = defineScenario({
  id: 'team',
  slug: 'team',
  title: 'Team members',
  suggestion: 'Add a team / user management screen',
  keywords: ['team', 'members', 'user management', 'users', 'invite', 'roles', 'permissions'],
  intent: { screenType: 'admin/user-management', entities: ['users[]'], actions: ['invite', 'openUser'], constraints: ['member counts', 'role + status visible'] },
  plan: {
    summary: 'Header with "Invite member", three summary tiles (members, active, invited) and a members table from the users table.',
    items: ['Title + invite action', '3 KPI tiles derived from users', 'Members table: name, email, role, team, status, last active', 'Tiles stack on phones'],
  },
  components: [
    c('root', 'Column', { gap: 'lg' }, ['header', 'stats', 'tableCard']),
    c('header', 'Row', { justify: 'between' }, ['titleCol', 'invite']),
    c('titleCol', 'Column', { gap: 'sm' }, ['title', 'subtitle']),
    c('title', 'AavaHeading', { text: 'Team members', level: 1 }),
    c('subtitle', 'AavaText', { text: 'Manage who can generate, approve and publish screens.', tone: 'muted' }),
    c('invite', 'AavaButton', { variant: 'primary', label: 'Invite member', icon: 'plus', action: { event: { name: 'invite' } } }),
    c('stats', 'Grid', { columns: 3 }, ['s1', 's2', 's3']),
    c('s1', 'AavaStatCard', { label: 'Members', value: '—', delta: '', trend: 'up', sentiment: 'positive' }),
    c('s2', 'AavaStatCard', { label: 'Active', value: '—', delta: '', trend: 'up', sentiment: 'positive' }),
    c('s3', 'AavaStatCard', { label: 'Pending invites', value: '—', delta: '', trend: 'down', sentiment: 'negative' }),
    c('tableCard', 'AavaCard', { title: 'Members' }, ['table']),
    c('table', 'AavaTable', {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'team', label: 'Team' },
        { key: 'status', label: 'Status' },
        { key: 'lastActive', label: 'Last active', align: 'end' },
      ],
      rows: [],
      statusKey: 'status',
    }),
  ],
  dataModel: {},
  dataNeeds: [
    {
      table: 'users',
      limit: 12,
      describe: 'members',
      bindings: [
        { componentId: 'table', prop: 'rows' },
        { componentId: 's1', prop: 'props' },
        { componentId: 's2', prop: 'props' },
        { componentId: 's3', prop: 'props' },
      ],
      apply: (rows) => {
        const active = rows.filter((r) => r.status === 'Active').length
        const invited = rows.filter((r) => r.status === 'Invited').length
        return {
          table: { rows: rows.map((r) => ({ name: str(r.name), email: str(r.email), role: str(r.role), team: str(r.team), status: str(r.status), lastActive: str(r.last_active) })) },
          s1: { value: String(rows.length), delta: '+2 this month' },
          s2: { value: String(active), delta: `${Math.round((active / rows.length) * 100)}% of seats` },
          s3: { value: String(invited), delta: 'awaiting acceptance' },
        }
      },
    },
  ],
})

export const notificationsScenario: Scenario = defineScenario({
  id: 'notifications',
  slug: 'notifications',
  title: 'Notifications',
  suggestion: 'Add a notifications inbox',
  keywords: ['notifications', 'inbox', 'alerts', 'activity feed', 'messages'],
  intent: { screenType: 'communication/inbox', entities: ['notifications[]'], actions: ['markAllRead', 'openNotification'], constraints: ['unread emphasis', 'grouped by recency'] },
  plan: {
    summary: 'Inbox header with "Mark all read", a filter, and a list of notifications from the notifications table with unread emphasis.',
    items: ['Title + unread count', 'Filter select + "Mark all read"', 'List rows: title, body, time, kind badge, unread dot', 'Full-width rows on phones'],
  },
  components: [
    c('root', 'Column', { gap: 'lg', maxWidth: 820, align: 'center' }, ['header', 'listCard']),
    c('header', 'Row', { justify: 'between' }, ['titleCol', 'actions']),
    c('titleCol', 'Column', { gap: 'sm' }, ['title', 'subtitle']),
    c('title', 'AavaHeading', { text: 'Notifications', level: 1 }),
    c('subtitle', 'AavaText', { text: 'Loading…', tone: 'muted' }),
    c('actions', 'Row', {}, ['filter', 'markAll']),
    c('filter', 'AavaSelect', { label: 'Filter', hideLabel: true, options: ['All', 'Unread', 'HITL', 'Deployments', 'Quality'], value: { path: '/filters/kind' } }),
    c('markAll', 'AavaButton', { variant: 'ghost', label: 'Mark all read', icon: 'check', action: { event: { name: 'markAllRead' } } }),
    c('listCard', 'AavaCard', {}, ['list']),
    c('list', 'AavaList', { variant: 'list', items: [], action: { event: { name: 'openNotification' } } }),
  ],
  dataModel: { filters: { kind: 'All' } },
  dataNeeds: [
    {
      table: 'notifications',
      limit: 20,
      describe: 'notifications',
      bindings: [{ componentId: 'list', prop: 'items' }],
      apply: (rows) => ({
        list: { items: rows.map((r) => ({ title: str(r.title), subtitle: str(r.body), meta: str(r.created_at), badge: str(r.kind).toUpperCase(), tone: r.kind === 'hitl' ? 'warning' : r.kind === 'deploy' ? 'success' : 'neutral', unread: !r.read })) },
        subtitle: { text: `${rows.filter((r) => !r.read).length} unread of ${rows.length}` },
      }),
    },
  ],
})

export const checkoutScenario: Scenario = defineScenario({
  id: 'checkout',
  slug: 'checkout',
  title: 'Checkout',
  suggestion: 'Add a checkout / payment screen',
  keywords: ['checkout', 'payment', 'cart', 'billing', 'pay'],
  intent: { screenType: 'commerce/checkout', entities: ['shipping.*', 'payment.*', 'cart_items[]'], actions: ['pay', 'backToCart'], constraints: ['summary always visible', 'PCI: no card data stored client-side'] },
  plan: {
    summary: 'Two columns: shipping + payment forms on the left, an order summary from cart_items with the pay action on the right.',
    items: ['Shipping card: name, address, city, postcode, country', 'Payment card: card number, expiry, CVC', 'Summary card: cart items, total, primary "Pay" button', 'Summary moves below the forms on phones'],
  },
  components: [
    c('root', 'Column', { gap: 'lg' }, ['title', 'layout']),
    c('title', 'AavaHeading', { text: 'Checkout', level: 1 }),
    c('layout', 'Grid', { columns: 2 }, ['forms', 'summary']),
    c('forms', 'Column', { gap: 'lg' }, ['shipping', 'payment']),
    c('shipping', 'AavaCard', { title: 'Shipping details' }, ['fullName', 'address', 'cityRow', 'country']),
    c('fullName', 'AavaTextField', { label: 'Full name', required: true, value: { path: '/shipping/name' } }),
    c('address', 'AavaTextField', { label: 'Address', required: true, value: { path: '/shipping/address' } }),
    c('cityRow', 'Grid', { columns: 2 }, ['city', 'postcode']),
    c('city', 'AavaTextField', { label: 'City', required: true, value: { path: '/shipping/city' } }),
    c('postcode', 'AavaTextField', { label: 'Postcode', required: true, value: { path: '/shipping/postcode' } }),
    c('country', 'AavaSelect', { label: 'Country', options: ['India', 'United Kingdom', 'United States', 'Germany'], value: { path: '/shipping/country' } }),
    c('payment', 'AavaCard', { title: 'Payment', subtitle: 'Card details are tokenised by the payment provider.' }, ['card', 'cardRow']),
    c('card', 'AavaTextField', { label: 'Card number', placeholder: '1234 5678 9012 3456', required: true, value: { path: '/payment/card' } }),
    c('cardRow', 'Grid', { columns: 2 }, ['expiry', 'cvc']),
    c('expiry', 'AavaTextField', { label: 'Expiry', placeholder: 'MM / YY', required: true, value: { path: '/payment/expiry' } }),
    c('cvc', 'AavaTextField', { label: 'CVC', placeholder: '123', required: true, value: { path: '/payment/cvc' } }),
    c('summary', 'AavaCard', { title: 'Order summary' }, ['items', 'total', 'pay', 'secure']),
    c('items', 'AavaList', { variant: 'list', items: [] }),
    c('total', 'AavaText', { text: 'Total —', weight: 'strong' }),
    c('pay', 'AavaButton', { variant: 'primary', label: 'Pay', fullWidth: true, icon: 'lock', action: { event: { name: 'pay' } } }),
    c('secure', 'AavaText', { text: 'Secured by AAVA Pay · 256-bit TLS', tone: 'subtle', size: 'sm', align: 'center' }),
  ],
  dataModel: { shipping: { name: '', address: '', city: '', postcode: '', country: 'India' }, payment: { card: '', expiry: '', cvc: '' } },
  dataNeeds: [
    {
      table: 'cart_items',
      limit: 20,
      describe: 'cart items',
      bindings: [
        { componentId: 'items', prop: 'items' },
        { componentId: 'total', prop: 'props' },
        { componentId: 'pay', prop: 'props' },
      ],
      apply: (rows) => {
        const total = rows.reduce((n, r) => n + Number(r.qty) * Number(r.price), 0)
        return {
          items: { items: rows.map((r) => ({ title: str(r.product), subtitle: `Qty ${r.qty}`, meta: money(Number(r.qty) * Number(r.price)) })) },
          total: { text: `Total ${money(total)}` },
          pay: { label: `Pay ${money(total)}` },
        }
      },
    },
  ],
  quality: [
    {
      dims: [0.78, 0.92, 0.84, 0.82, 0.86],
      lintErrors: 1,
      a11yCritical: 1,
      rawColours: 1,
      gaps: [
        { el: '#pay', prop: 'contrast', found: '3.8:1', expected: '≥ 4.5:1', rule: 'WCAG 1.4.3', fix: 'token', severity: 'hard', source: 'audit' },
        { el: '.summary', prop: 'position', found: 'static', expected: 'sticky ≥ 1024px', rule: 'UX-CHECKOUT-02', fix: 'prop', severity: 'soft', source: 'critic' },
      ],
    },
    { dims: [0.95, 0.95, 0.91, 0.95, 0.9], lintErrors: 0, a11yCritical: 0, rawColours: 0, gaps: [] },
  ],
  defects: ['.pay { background: #3d8bfd; } // 3.8:1 contrast'],
})
