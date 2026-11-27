import { useState, type ReactNode } from 'react'
import { useLedger } from '@/app/providers/LedgerProvider'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { DEFAULT_ASSUMPTIONS } from '@/config/roi'
import { ROLE_LABEL, ROLES } from '@/services/roi/engine'
import type { Assumptions, Complexity } from '@/types/roi'
import styles from './Roi.module.scss'

const CX: Complexity[] = ['simple', 'medium', 'complex']

/** Every non-measured input of the value engine — edited here, applied live, persisted. */
export function AssumptionsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { assumptions, setAssumptions, resetAssumptions } = useLedger()
  // Remount the form only on reset — never per keystroke (that would drop input focus).
  const [resetKey, setResetKey] = useState(0)
  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title="ROI assumptions"
      subtitle="Measured data comes from the run ledger; these inputs are yours to calibrate. Changes recalculate instantly."
      footer={
        <>
          <Button
            variant="ghost"
            icon="refresh"
            onClick={() => {
              resetAssumptions()
              setResetKey((k) => k + 1)
            }}
          >
            Reset defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <Form key={resetKey} value={assumptions} onChange={setAssumptions} />
    </Drawer>
  )
}

function Num({ label, value, onChange, step = 1, suffix, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; hint?: string }) {
  const [draft, setDraft] = useState(String(value))
  return (
    <label className={styles.aField}>
      <span>{label}</span>
      <span className={styles.numInput}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value !== '' && Number.isFinite(n) && n >= 0) onChange(n)
          }}
        />
        {suffix && <em>{suffix}</em>}
      </span>
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.aGroup}>
      <h3>{title}</h3>
      {note && <p>{note}</p>}
      {children}
    </section>
  )
}

function Form({ value: a, onChange }: { value: Assumptions; onChange: (a: Assumptions) => void }) {
  const set = (patch: Partial<Assumptions>) => onChange({ ...a, ...patch })
  const matrix = (key: 'baselineHours' | 'residualHours', title: string, note: string) => (
    <Group title={title} note={note}>
      <div className={styles.matrix} role="table" aria-label={title}>
        <span role="columnheader" />
        {ROLES.map((r) => (
          <span key={r} role="columnheader" className={styles.matrixHead}>
            {ROLE_LABEL[r]}
          </span>
        ))}
        {CX.map((cx) => (
          <div key={cx} role="row" className={styles.matrixRow}>
            <span role="rowheader" className={styles.matrixRowHead}>
              {cx}
            </span>
            {ROLES.map((r) => (
              <Num key={r} label={`${cx} ${ROLE_LABEL[r]}`} value={a[key][cx][r]} step={0.25} suffix="h" onChange={(v) => set({ [key]: { ...a[key], [cx]: { ...a[key][cx], [r]: v } } } as Partial<Assumptions>)} />
            ))}
          </div>
        ))}
      </div>
    </Group>
  )

  return (
    <div className={styles.aForm}>
      <Group title="Blended hourly rates" note="Fully loaded cost per hour, per role.">
        <div className={styles.aGrid}>
          {ROLES.map((r) => (
            <Num key={r} label={ROLE_LABEL[r]} value={a.rates[r]} suffix="$/h" onChange={(v) => set({ rates: { ...a.rates, [r]: v } })} />
          ))}
        </div>
      </Group>

      {matrix('baselineHours', 'Baseline effort per screen', 'Manual design → development → QA, by screen complexity (simple ≤ 12 components, complex > 18).')}
      {matrix('residualHours', 'Remaining effort after generation', 'Human work still needed per generated screen: business logic, API wiring, review. HITL time is measured separately.')}

      <Group title="Refinements & lead time">
        <div className={styles.aGrid}>
          {ROLES.map((r) => (
            <Num key={r} label={`Manual change · ${ROLE_LABEL[r]}`} value={a.refineBaselineHours[r]} step={0.25} suffix="h" onChange={(v) => set({ refineBaselineHours: { ...a.refineBaselineHours, [r]: v } })} />
          ))}
          {CX.map((cx) => (
            <Num key={cx} label={`Lead time · ${cx}`} value={a.baselineLeadDays[cx]} step={0.5} suffix="days" onChange={(v) => set({ baselineLeadDays: { ...a.baselineLeadDays, [cx]: v } })} />
          ))}
          <Num label="Working hours per day" value={a.hoursPerDay} step={0.5} suffix="h" onChange={(v) => set({ hoursPerDay: v })} />
        </div>
      </Group>

      <Group title="Model pricing" note="USD per 1M tokens by model tier — replace with your contract rates. Cached input is billed at the cached rate.">
        {(['small', 'medium', 'large'] as const).map((t) => (
          <div key={t} className={styles.aGrid}>
            <Num label={`${t} · input`} value={a.pricing[t].input} step={0.05} suffix="$" onChange={(v) => set({ pricing: { ...a.pricing, [t]: { ...a.pricing[t], input: v } } })} />
            <Num label={`${t} · output`} value={a.pricing[t].output} step={0.05} suffix="$" onChange={(v) => set({ pricing: { ...a.pricing, [t]: { ...a.pricing[t], output: v } } })} />
            <Num label={`${t} · cached input`} value={a.pricing[t].cachedInput} step={0.01} suffix="$" onChange={(v) => set({ pricing: { ...a.pricing, [t]: { ...a.pricing[t], cachedInput: v } } })} />
          </div>
        ))}
      </Group>

      <Group title="Platform, budget & quality">
        <div className={styles.aGrid}>
          <Num label="Platform & ops cost" value={a.platformMonthlyCost} step={10} suffix="$/mo" hint="Licences, hosting, maintenance — pro-rated to the period." onChange={(v) => set({ platformMonthlyCost: v })} />
          <Num label="Implementation (one-time)" value={a.implementationCost} step={500} suffix="$" hint="Build & rollout effort, amortised into investment." onChange={(v) => set({ implementationCost: v })} />
          <Num label="Amortise over" value={a.amortisationMonths} suffix="months" onChange={(v) => set({ amortisationMonths: Math.max(1, v) })} />
          <Num label="AI budget" value={a.monthlyAiBudget} step={10} suffix="$/mo" onChange={(v) => set({ monthlyAiBudget: v })} />
          <Num label="Cost of a late defect" value={a.defectCost} step={10} suffix="$" hint="Applied to each gap the Fixer auto-resolved." onChange={(v) => set({ defectCost: v })} />
          <Num label="Manual first-pass compliance" value={Math.round(a.baselineFirstPass * 100)} suffix="%" onChange={(v) => set({ baselineFirstPass: Math.min(100, v) / 100 })} />
          <Num label="Full-code tokens per line" value={a.tokensPerLoc} suffix="tok" onChange={(v) => set({ tokensPerLoc: v })} />
          <Num label="Full-code context per call" value={a.fullCodeContextTokens} step={500} suffix="tok" hint="Design docs re-sent each loop without retrieval." onChange={(v) => set({ fullCodeContextTokens: v })} />
          <Num label="Full-code regeneration loops" value={a.regenLoops} step={0.5} suffix="×" onChange={(v) => set({ regenLoops: v })} />
        </div>
      </Group>

      <p className={styles.aFoot}>Defaults are illustrative starting points ({DEFAULT_ASSUMPTIONS.baselineHours.medium.dev} dev hours for a medium screen, {DEFAULT_ASSUMPTIONS.baselineFirstPass * 100}% manual first-pass). Calibrate them against real timesheets in the pilot.</p>
    </div>
  )
}
