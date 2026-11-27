import { useEffect, useMemo, useState } from 'react'
import { useDataSources } from '@/app/providers/DataSourceProvider'
import { useRun } from '@/app/providers/RunProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Icon } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Switch'
import { DB_KINDS } from '@/services/datasource/client'
import { bindableComponents, type Bindable } from '@/services/datasource/bindings'
import type { DbKind, Row, TableSchema } from '@/types/datasource'
import { cx } from '@/utils/format'
import styles from './DataSourcesDrawer.module.scss'

interface Props {
  open: boolean
  onClose: () => void
}

/** Connect databases, browse tables, preview rows and import them into the active screen. */
export function DataSourcesDrawer({ open, onClose }: Props) {
  const ds = useDataSources()
  return (
    <Drawer open={open} onClose={onClose} wide title="Data sources" subtitle="Agents import real rows from the active connection during the Mind step.">
      <Connections />
      {ds.active ? <Browser key={ds.active.id} sourceId={ds.active.id} /> : <p className={styles.muted}>Activate a connected source to browse tables and bind data.</p>}
    </Drawer>
  )
}

function Connections() {
  const ds = useDataSources()
  const [adding, setAdding] = useState(false)
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h3>Connections</h3>
        <Button size="sm" icon={adding ? 'x' : 'plus'} variant={adding ? 'ghost' : 'secondary'} onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add'}
        </Button>
      </header>
      {adding && <AddConnection onDone={() => setAdding(false)} />}
      <ul className={styles.sources}>
        {ds.sources.map((s) => {
          const active = ds.active?.id === s.id
          return (
            <li key={s.id} className={cx(styles.source, active && styles.sourceOn)}>
              <span className={styles.dbIcon} aria-hidden>
                <Icon name="database" size={16} />
              </span>
              <div className={styles.sourceText}>
                <strong>{s.name}</strong>
                <code>
                  {DB_KINDS.find((k) => k.value === s.kind)?.label} · {s.user ? `${s.user}@` : ''}
                  {s.host}:{s.port}/{s.database}
                </code>
                {s.lastMessage && s.status === 'error' && <span className={styles.err}>{s.lastMessage}</span>}
              </div>
              <Badge size="sm" tone={s.status === 'connected' ? 'success' : s.status === 'error' ? 'danger' : 'neutral'} dot>
                {s.status}
              </Badge>
              {s.status === 'connected' && (
                <Button size="sm" variant={active ? 'primary' : 'secondary'} onClick={() => ds.setActive(active ? null : s.id)} aria-pressed={active}>
                  {active ? 'Active' : 'Use'}
                </Button>
              )}
              {s.id !== 'demo' && <IconButton size="sm" icon="trash" label={`Remove ${s.name}`} onClick={() => ds.remove(s.id)} />}
            </li>
          )
        })}
      </ul>
      <p className={styles.hint}>
        <Icon name="lock" size={12} /> Passwords are sent to the data BFF for this test only — never stored in the browser or shown to the LLM.
        {ds.clientKind === 'mock' && ' Using the in-browser demo database (set VITE_DATA_API_URL for a real BFF).'}
      </p>
    </section>
  )
}

function AddConnection({ onDone }: { onDone: () => void }) {
  const ds = useDataSources()
  const [kind, setKind] = useState<DbKind>('postgres')
  const [form, setForm] = useState({ name: 'Orders DB', host: 'db.company.internal', port: 5432, database: 'commerce', user: 'readonly', password: '', ssl: true })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof form, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    const res = await ds.add({ name: form.name, kind, host: form.host, port: Number(form.port), database: form.database, user: form.user, ssl: form.ssl }, form.password)
    setBusy(false)
    setMsg({ ok: res.ok, text: `${res.message} (${res.latencyMs} ms)` })
    if (res.ok) setTimeout(onDone, 700)
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className={styles.field}>
        <span>Name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span>Type</span>
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as DbKind
            setKind(k)
            set('port', DB_KINDS.find((x) => x.value === k)!.port)
          }}
        >
          {DB_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className={cx(styles.field, styles.span2)}>
        <span>Host</span>
        <input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="db.example.com" required />
      </label>
      <label className={styles.field}>
        <span>Port</span>
        <input type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
      </label>
      <label className={styles.field}>
        <span>Database</span>
        <input value={form.database} onChange={(e) => set('database', e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>User</span>
        <input value={form.user} onChange={(e) => set('user', e.target.value)} autoComplete="off" />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
      </label>
      <div className={styles.span2}>
        <Switch label="Require SSL/TLS" checked={form.ssl} onChange={(v) => set('ssl', v)} />
      </div>
      {msg && (
        <p className={cx(styles.result, styles.span2, msg.ok ? styles.ok : styles.bad)}>
          <Icon name={msg.ok ? 'check' : 'alert'} size={14} /> {msg.text}
        </p>
      )}
      <div className={styles.span2}>
        <Button type="submit" variant="primary" icon="plug" loading={busy} block>
          Test & save connection
        </Button>
      </div>
    </form>
  )
}

function Browser({ sourceId }: { sourceId: string }) {
  const ds = useDataSources()
  const [tables, setTables] = useState<TableSchema[] | null>(null)
  const [table, setTable] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    ds.listTables(sourceId)
      .then((t) => {
        if (!live) return
        setTables(t)
        setTable((cur) => cur ?? t[0]?.name ?? null)
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId])

  useEffect(() => {
    if (!table) return
    let live = true
    ds.query(sourceId, table, 8)
      .then((r) => live && setRows(r))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, table])

  const schema = tables?.find((t) => t.name === table)

  return (
    <>
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <h3>Tables</h3>
          {tables && <Badge size="sm">{tables.length}</Badge>}
        </header>
        {error && <p className={cx(styles.result, styles.bad)}>{error}</p>}
        {!tables ? (
          <p className={styles.muted}>Introspecting schema…</p>
        ) : (
          <div className={styles.tables} role="listbox" aria-label="Tables">
            {tables.map((t) => (
              <button key={t.name} type="button" role="option" aria-selected={t.name === table} className={cx(styles.tableChip, t.name === table && styles.tableOn)} onClick={() => setTable(t.name)}>
                <Icon name="table" size={13} />
                {t.name}
                <span>{t.rowCount}</span>
              </button>
            ))}
          </div>
        )}
        {schema && (
          <>
            <p className={styles.schema}>
              {schema.description} ·{' '}
              {schema.columns.map((c) => (
                <code key={c.name} title={c.type}>
                  {c.pk ? '🔑 ' : ''}
                  {c.name}
                  <i>{c.type}</i>
                </code>
              ))}
            </p>
            {rows && <RowsPreview rows={rows} />}
          </>
        )}
      </section>
      {schema && <BindPanel key={schema.name} schema={schema} />}
    </>
  )
}

function RowsPreview({ rows }: { rows: Row[] }) {
  const cols = Object.keys(rows[0] ?? {})
  return (
    <div className={styles.preview}>
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{String(r[c] ?? '∅')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BindPanel({ schema }: { schema: TableSchema }) {
  const { activeScreen, bindData, isBusy } = useRun()
  const targets = useMemo(() => bindableComponents(activeScreen), [activeScreen])
  const [targetId, setTargetId] = useState<string>('')
  const target: Bindable | undefined = targets.find((t) => t.id === targetId) ?? targets[0]
  const cols = schema.columns.map((c) => c.name)
  const [columns, setColumns] = useState<string[]>(cols.slice(0, 5))
  const [label, setLabel] = useState(cols[1] ?? cols[0])
  const [value, setValue] = useState(cols[2] ?? cols[0])
  const [meta, setMeta] = useState(cols[3] ?? '')
  const [limit, setLimit] = useState(10)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!activeScreen?.surface) return null

  const submit = async () => {
    if (!target) return
    setBusy(true)
    setErr(null)
    try {
      await bindData({ componentId: target.id, prop: target.prop, table: schema.name, limit, mapping: { columns, label, value, meta: meta || undefined } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const colSelect = (v: string, on: (v: string) => void, allowNone = false) => (
    <select value={v} onChange={(e) => on(e.target.value)}>
      {allowNone && <option value="">— none —</option>}
      {cols.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  )

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h3>Import into “{activeScreen.shared.title}”</h3>
      </header>
      {targets.length === 0 ? (
        <p className={styles.muted}>This screen has no table, chart, list or select to bind. Try the Orders, Dashboard or Products screen.</p>
      ) : (
        <div className={styles.form}>
          <label className={cx(styles.field, styles.span2)}>
            <span>Target component</span>
            <select value={target?.id} onChange={(e) => setTargetId(e.target.value)}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.component} · #{t.id} ({t.prop}) — {t.label}
                </option>
              ))}
            </select>
          </label>

          {target?.prop === 'rows' && (
            <fieldset className={cx(styles.cols, styles.span2)}>
              <legend>Columns to show</legend>
              {cols.map((c) => (
                <label key={c} className={cx(styles.colChip, columns.includes(c) && styles.colOn)}>
                  <input type="checkbox" checked={columns.includes(c)} onChange={() => setColumns((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))} />
                  {c}
                </label>
              ))}
            </fieldset>
          )}
          {(target?.prop === 'data' || target?.prop === 'items' || target?.prop === 'options') && (
            <label className={styles.field}>
              <span>{target.prop === 'items' ? 'Title column' : 'Label column'}</span>
              {colSelect(label, setLabel)}
            </label>
          )}
          {target?.prop === 'data' && (
            <label className={styles.field}>
              <span>Value column (numeric)</span>
              {colSelect(value, setValue)}
            </label>
          )}
          {target?.prop === 'items' && (
            <>
              <label className={styles.field}>
                <span>Subtitle column</span>
                {colSelect(value, setValue, true)}
              </label>
              <label className={styles.field}>
                <span>Meta column</span>
                {colSelect(meta, setMeta, true)}
              </label>
            </>
          )}
          <label className={styles.field}>
            <span>Row limit</span>
            <input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(100, Number(e.target.value))))} />
          </label>
          {err && <p className={cx(styles.result, styles.bad, styles.span2)}>{err}</p>}
          <div className={styles.span2}>
            <Button variant="primary" icon="database" block loading={busy} disabled={isBusy || (target?.prop === 'rows' && columns.length === 0)} onClick={submit}>
              Import {schema.name} → #{target?.id}
            </Button>
            <p className={styles.hint}>Recompiles the screen’s Angular code and spec deterministically (no LLM tokens) and bumps the version.</p>
          </div>
        </div>
      )}
    </section>
  )
}
