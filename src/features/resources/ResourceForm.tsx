import { useState, type ChangeEvent } from 'react'
import { useResources } from '@/app/providers/ResourcesProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { RESOURCE_KINDS, kindMeta } from '@/services/resources/catalog'
import type { Resource, ResourceKind } from '@/types/resources'
import { cx } from '@/utils/format'
import styles from './Resources.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  /** Edit an existing resource instead of creating one. */
  editing?: Resource | null
}

const ACCEPT = '.md,.markdown,.txt,.json,.yaml,.yml,.csv,.html'
const MAX_FILE = 200_000

/** Add / edit a context resource. Secrets are forwarded to the indexer only and never persisted. */
export function ResourceForm({ open, onClose, editing }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add context resource'} subtitle="Agents retrieve from enabled resources in every conversation, or when you @mention them." icon="layers" size="md">
      <FormBody key={`${open}-${editing?.id ?? 'new'}`} editing={editing ?? null} onDone={onClose} />
    </Modal>
  )
}

function FormBody({ editing, onDone }: { editing: Resource | null; onDone: () => void }) {
  const { add, update } = useResources()
  const notify = useToast()
  const [kind, setKind] = useState<ResourceKind>(editing?.kind ?? 'codebase')
  const meta = kindMeta(kind)
  const [name, setName] = useState(editing?.name ?? '')
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...Object.fromEntries(meta.fields.map((f) => [f.key, f.default ?? ''])), ...(editing?.config ?? {}) }))
  const [secret, setSecret] = useState('')
  const [files, setFiles] = useState<{ name: string; size: number; text: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const pickKind = (k: ResourceKind) => {
    setKind(k)
    setValues(Object.fromEntries(kindMeta(k).fields.map((f) => [f.key, f.default ?? ''])))
    setError(null)
  }

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])]
    const read = await Promise.all(
      list.map(async (f) => ({ name: f.name, size: f.size, text: f.size > MAX_FILE ? (await f.text()).slice(0, MAX_FILE) : await f.text() })),
    )
    setFiles((cur) => [...cur, ...read])
    if (!name && read[0]) setName(read[0].name.replace(/\.[^.]+$/, ''))
  }

  const submit = () => {
    const missing = meta.fields.filter((f) => f.required && !values[f.key]?.trim())
    if (!name.trim()) return setError('Give the resource a name.')
    if (missing.length) return setError(`Required: ${missing.map((f) => f.label).join(', ')}`)
    if (kind === 'upload' && !files.length && !editing) return setError('Choose at least one file.')
    // Strip secret fields — they are passed to the indexing service only (simulated here).
    const config = Object.fromEntries(Object.entries(values).filter(([k]) => meta.fields.find((f) => f.key === k)?.type !== 'secret'))
    if (kind === 'upload' && files.length) Object.assign(config, { files: files.map((f) => f.name).join(', '), count: String(files.length) })
    const content = files.map((f) => `# ${f.name}\n${f.text}`).join('\n\n')
    if (editing) {
      update(editing.id, { name: name.trim(), config })
      notify(`Updated ${name.trim()}`, 'success')
    } else {
      add({ kind, name: name.trim(), config, content: content || undefined })
      notify(`Indexing ${name.trim()}${secret ? ' (token sent to indexer)' : ''}…`, 'info')
    }
    onDone()
  }

  return (
    <div className={styles.form}>
      {!editing && (
        <div className={styles.kindGrid} role="radiogroup" aria-label="Resource type">
          {RESOURCE_KINDS.map((k) => (
            <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} className={cx(styles.kindCard, kind === k.kind && styles.kindOn)} onClick={() => pickKind(k.kind)}>
              <Icon name={k.icon} size={18} />
              <strong>{k.label}</strong>
            </button>
          ))}
        </div>
      )}
      <p className={styles.kindDesc}>{meta.description}</p>

      <label className={styles.field}>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'codebase' ? 'acme/web-portal' : 'e.g. Checkout PRD'} />
      </label>

      {meta.fields.map((f) => (
        <label key={f.key} className={styles.field}>
          <span>
            {f.label}
            {f.required && <b className={styles.req}> *</b>}
            {f.type === 'secret' && <Icon name="lock" size={11} />}
          </span>
          {f.type === 'select' ? (
            <select value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
              {f.options!.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : f.type === 'secret' ? (
            <input type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={editing ? 'Leave empty to keep the current token' : ''} />
          ) : (
            <input value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} spellCheck={false} />
          )}
          {f.help && <small>{f.help}</small>}
        </label>
      ))}

      {kind === 'upload' && (
        <div className={styles.drop}>
          <label className={styles.dropZone}>
            <input type="file" multiple accept={ACCEPT} onChange={onFiles} />
            <Icon name="upload" size={22} />
            <strong>Choose files</strong>
            <span>Markdown, text, JSON, YAML, CSV — read locally in your browser</span>
          </label>
          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((f, i) => (
                <li key={i}>
                  <Icon name="fileText" size={13} />
                  <span>{f.name}</span>
                  <small>{(f.size / 1024).toFixed(1)} KB · ~{Math.ceil(f.text.length / 4).toLocaleString()} tokens</small>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                    <Icon name="x" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className={styles.error}>
          <Icon name="alert" size={14} /> {error}
        </p>
      )}

      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" icon={editing ? 'check' : 'plus'} onClick={submit}>
          {editing ? 'Save & re-index' : 'Add & index'}
        </Button>
      </div>
    </div>
  )
}
