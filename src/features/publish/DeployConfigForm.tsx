import { useMemo, useState } from 'react'
import { useToast } from '@/app/providers/ToastProvider'
import { Button, IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { downloadZip } from '@/services/export/zipExport'
import { apiEnvKey, generateDeployConfig, PROVIDER_FIELDS } from '@/services/publish/deployConfig'
import { PROVIDERS } from '@/services/publish/publish'
import type { CloudProvider, StackId } from '@/types/export'
import { cx } from '@/utils/format'
import type { DeploySettings } from './useDeploySettings'
import styles from '../export/export.module.scss'

interface Props {
  settings: DeploySettings
  stack: StackId
  projectName: string
  environment: 'preview' | 'production'
  secrets: Record<string, string>
  onSecret: (key: string, value: string) => void
}

/** Provider picker + provider-specific settings + env vars + live preview of the generated config. */
export function DeployConfigForm({ settings, stack, projectName, environment, secrets, onSecret }: Props) {
  const notify = useToast()
  const p = settings.provider
  const values = settings.valuesFor(p)
  const fields = PROVIDER_FIELDS[p]
  const generated = useMemo(() => generateDeployConfig(settings.config(p), stack, projectName, environment), [settings, p, stack, projectName, environment])
  const [file, setFile] = useState(0)
  const shown = generated.files[Math.min(file, generated.files.length - 1)]
  const envKey = apiEnvKey(stack)

  const setEnv = (i: number, patch: Partial<{ key: string; value: string }>) => settings.setEnvVars(settings.envVars.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  return (
    <div className={styles.configure}>
      <div className={styles.providerGrid} role="radiogroup" aria-label="Cloud provider">
        {PROVIDERS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={p === x.id}
            className={cx(styles.providerCard, p === x.id && styles.stackOn)}
            onClick={() => {
              settings.setProvider(x.id as CloudProvider)
              setFile(0)
            }}
          >
            <Icon name="cloud" size={18} />
            <strong>{x.name}</strong>
            <span>{x.service}</span>
          </button>
        ))}
      </div>

      <fieldset className={styles.fieldset}>
        <legend>{PROVIDERS.find((x) => x.id === p)?.name} settings</legend>
        <div className={styles.row2}>
          {fields.map((f) => (
            <label key={f.key} className={styles.field}>
              <span>
                {f.label}
                {f.required && <b className={styles.req}> *</b>}
                {f.type === 'secret' && <Icon name="lock" size={11} className={styles.lockIcon} />}
              </span>
              {f.type === 'select' ? (
                <select className={styles.input} value={values[f.key]} onChange={(e) => settings.setValue(p, f.key, e.target.value)}>
                  {f.options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={styles.input}
                  type={f.type === 'secret' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                  autoComplete={f.type === 'secret' ? 'off' : undefined}
                  placeholder={f.placeholder}
                  value={f.type === 'secret' ? (secrets[f.key] ?? '') : values[f.key]}
                  onChange={(e) => (f.type === 'secret' ? onSecret(f.key, e.target.value) : settings.setValue(p, f.key, e.target.value))}
                  spellCheck={false}
                />
              )}
              {f.help && <span className={styles.hint}>{f.help}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Environment variables</legend>
        <label className={styles.field}>
          <span>Data API URL ({envKey})</span>
          <input
            className={styles.input}
            placeholder="https://api.example.com (empty = use imported seed data)"
            value={settings.apiUrl}
            onChange={(e) => settings.setApiUrl(e.target.value.trim())}
            spellCheck={false}
          />
          <span className={styles.hint}>Baked into the build so screens fetch DB collections live from GET {'{url}'}/collections/:table.</span>
        </label>
        <ul className={styles.envList}>
          {settings.envVars.map((e, i) => (
            <li key={i}>
              <input className={styles.input} placeholder="KEY" value={e.key} onChange={(ev) => setEnv(i, { key: ev.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} aria-label="Variable name" />
              <input className={styles.input} placeholder="value" value={e.value} onChange={(ev) => setEnv(i, { value: ev.target.value })} aria-label="Variable value" />
              <IconButton size="sm" icon="trash" label="Remove variable" onClick={() => settings.setEnvVars(settings.envVars.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => settings.setEnvVars([...settings.envVars, { key: '', value: '' }])}>
          Add variable
        </Button>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Generated configuration</legend>
        <p className={styles.hint}>{generated.summary}</p>
        <div className={styles.configTabs} role="tablist" aria-label="Config files">
          {generated.files.map((g, i) => (
            <button key={g.path} type="button" role="tab" aria-selected={i === file} className={cx(styles.configTab, i === file && styles.configTabOn)} onClick={() => setFile(i)}>
              {g.path}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={file === -1} className={cx(styles.configTab, file === -1 && styles.configTabOn)} onClick={() => setFile(-1)}>
            CLI
          </button>
        </div>
        <pre className={cx(styles.code, styles.configCode)}>{file === -1 ? generated.commands.join('\n') : shown?.content}</pre>
        <div className={styles.configActions}>
          <Button
            size="sm"
            icon="copy"
            onClick={() => {
              void navigator.clipboard?.writeText(file === -1 ? generated.commands.join('\n') : (shown?.content ?? ''))
              notify('Copied', 'success')
            }}
          >
            Copy
          </Button>
          <Button size="sm" icon="download" onClick={() => void downloadZip(generated.files, [], `${projectName}-${p}-config`)}>
            Config files
          </Button>
        </div>
      </fieldset>
    </div>
  )
}
