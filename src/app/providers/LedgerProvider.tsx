import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_ASSUMPTIONS, ROI_STORAGE } from '@/config/roi'
import { useLocalStorage } from '@/hooks'
import type { Assumptions, RunRecord } from '@/types/roi'

interface LedgerApi {
  records: RunRecord[]
  record: (r: RunRecord) => void
  clear: () => void
  assumptions: Assumptions
  setAssumptions: (a: Assumptions) => void
  resetAssumptions: () => void
}

const Ctx = createContext<LedgerApi | null>(null)
const MAX_ROWS = 2000

/** Append-only ledger of finished runs + the editable ROI assumptions. */
export function LedgerProvider({ children }: { children: ReactNode }) {
  const [ledger, setLedger] = useLocalStorage<{ rows: RunRecord[] }>(ROI_STORAGE.ledger, { rows: [] })
  const [stored, setStored] = useLocalStorage<{ a: Assumptions }>(ROI_STORAGE.assumptions, { a: DEFAULT_ASSUMPTIONS })

  const record = useCallback((r: RunRecord) => setLedger((l) => (l.rows.some((x) => x.id === r.id) ? l : { rows: [...l.rows, r].slice(-MAX_ROWS) })), [setLedger])

  const api = useMemo<LedgerApi>(
    () => ({
      records: ledger.rows,
      record,
      clear: () => setLedger({ rows: [] }),
      // Merge with defaults so newly added assumption fields always have a value.
      assumptions: { ...DEFAULT_ASSUMPTIONS, ...stored.a },
      setAssumptions: (a) => setStored({ a }),
      resetAssumptions: () => setStored({ a: DEFAULT_ASSUMPTIONS }),
    }),
    [ledger.rows, record, setLedger, stored.a, setStored],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useLedger() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLedger must be used inside <LedgerProvider>')
  return ctx
}
