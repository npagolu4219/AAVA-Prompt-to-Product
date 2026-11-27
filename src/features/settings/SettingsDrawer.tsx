import type { ReactNode } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { THEME_PRESETS } from '@/config/themes'
import type { ThemeSettings } from '@/types/theme'
import { contrastRatio, isHex, normalizeHex } from '@/utils/color'
import { cx } from '@/utils/format'
import styles from './SettingsDrawer.module.scss'

interface Props {
  open: boolean
  onClose: () => void
}

type ColorKey = 'primary' | 'accent' | 'ink'

const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, focus, progress, links' },
  { key: 'accent', label: 'Accent', hint: 'Live steps, HITL, highlights' },
  { key: 'ink', label: 'Ink', hint: 'Header & brand surfaces' },
]

/** Fully user-configurable theme + run behaviour. Persisted in localStorage. */
export function SettingsDrawer({ open, onClose }: Props) {
  const { settings, update, applyPreset, reset, isCustomized } = useTheme()
  const { options, setOptions, agentKind } = useRun()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Theme & settings"
      subtitle="Changes apply instantly and are saved on this device."
      footer={
        <>
          <Button variant="ghost" icon="refresh" onClick={reset}>
            Reset theme
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <section className={styles.section}>
        <h3 className={styles.heading}>
          Colour theme {isCustomized && <Badge size="sm" tone="accent">Customised</Badge>}
        </h3>
        <div className={styles.presets} role="radiogroup" aria-label="Theme presets">
          {THEME_PRESETS.map((p) => {
            const active = p.id === settings.presetId && !isCustomized
            return (
              <button key={p.id} type="button" role="radio" aria-checked={active} className={cx(styles.preset, active && styles.presetActive)} onClick={() => applyPreset(p.id)}>
                <span className={styles.swatches} aria-hidden>
                  <span style={{ background: p.ink }} />
                  <span style={{ background: p.primary }} />
                  <span style={{ background: p.accent }} />
                </span>
                <span className={styles.presetName}>{p.name}</span>
                <span className={styles.presetDesc}>{p.description}</span>
                {active && <Icon name="check" size={14} strokeWidth={3} className={styles.presetCheck} />}
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Mode</h3>
        <SegmentedControl<ThemeSettings['mode']>
          label="Colour mode"
          block
          value={settings.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: 'light', label: 'Light', icon: 'sun' },
            { value: 'dark', label: 'Dark', icon: 'moon' },
            { value: 'system', label: 'System', icon: 'monitor' },
          ]}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Custom colours</h3>
        <div className={styles.colors}>
          {COLOR_FIELDS.map((f) => (
            <ColorField key={f.key} label={f.label} hint={f.hint} value={settings[f.key]} onChange={(v) => update({ [f.key]: v })} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Shape & density</h3>
        <div className={styles.stack}>
          <Field label="Corner radius">
            <SegmentedControl<ThemeSettings['radius']>
              label="Corner radius"
              block
              size="sm"
              value={settings.radius}
              onChange={(radius) => update({ radius })}
              options={[
                { value: 'sharp', label: 'Sharp' },
                { value: 'rounded', label: 'Rounded' },
                { value: 'soft', label: 'Soft' },
              ]}
            />
          </Field>
          <Field label="Density">
            <SegmentedControl<ThemeSettings['density']>
              label="Density"
              block
              size="sm"
              value={settings.density}
              onChange={(density) => update({ density })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'spacious', label: 'Spacious' },
              ]}
            />
          </Field>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Typography</h3>
        <div className={styles.stack}>
          <Field label="Font">
            <SegmentedControl<ThemeSettings['fontFamily']>
              label="Font family"
              block
              size="sm"
              value={settings.fontFamily}
              onChange={(fontFamily) => update({ fontFamily })}
              options={[
                { value: 'plex', label: 'IBM Plex' },
                { value: 'inter', label: 'Inter' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Field>
          <Field label="Text size">
            <SegmentedControl<ThemeSettings['fontScale']>
              label="Text size"
              block
              size="sm"
              value={settings.fontScale}
              onChange={(fontScale) => update({ fontScale })}
              options={[
                { value: 'sm', label: 'Small' },
                { value: 'md', label: 'Default' },
                { value: 'lg', label: 'Large' },
              ]}
            />
          </Field>
          <Switch label="Reduce motion" description="Turn off transitions and pulsing indicators." checked={settings.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Run behaviour</h3>
        <div className={styles.stack}>
          <Switch
            label="Auto-approve plan (skip HITL ①)"
            description="For trusted templates. Final sign-off (HITL ②) always stays on."
            checked={options.autoApprovePlan}
            onChange={(autoApprovePlan) => setOptions({ autoApprovePlan })}
          />
          <Field label="Simulation speed">
            <SegmentedControl<number>
              label="Simulation speed"
              block
              size="sm"
              value={options.speed}
              onChange={(speed) => setOptions({ speed })}
              options={[
                { value: 0.5, label: '0.5×' },
                { value: 1, label: '1×' },
                { value: 2, label: '2×' },
                { value: 4, label: '4×' },
              ]}
            />
          </Field>
          <div className={styles.agentNote}>
            <Icon name="bolt" size={14} />
            <span>
              Agent backend: <strong>{agentKind === 'mock' ? 'Mock (dummy data)' : 'AG-UI over SSE'}</strong>. Set <code>VITE_AGENT_URL</code> to stream from a real AAVA endpoint.
            </span>
          </div>
        </div>
      </section>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  )
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const ratio = contrastRatio(value, '#FFFFFF')
  return (
    <div className={styles.color}>
      <label className={styles.swatchInput} style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(normalizeHex(e.target.value))} aria-label={`${label} colour picker`} />
      </label>
      <div className={styles.colorText}>
        <span className={styles.colorLabel}>
          {label}
          <span className={cx(styles.contrast, ratio >= 4.5 ? styles.aa : styles.fail)} title="Contrast against white text">
            {ratio.toFixed(1)}:1
          </span>
        </span>
        <span className={styles.colorHint}>{hint}</span>
      </div>
      <input
        className={styles.hex}
        defaultValue={value}
        key={value}
        aria-label={`${label} hex value`}
        spellCheck={false}
        onBlur={(e) => isHex(e.target.value) && onChange(normalizeHex(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && isHex(e.currentTarget.value) && onChange(normalizeHex(e.currentTarget.value))}
      />
    </div>
  )
}
