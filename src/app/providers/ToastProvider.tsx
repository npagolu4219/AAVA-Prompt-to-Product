import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { uid } from '@/utils/format'
import styles from './Toast.module.scss'

type Tone = 'info' | 'success' | 'warning' | 'danger'
interface Toast {
  id: string
  message: string
  tone: Tone
}

const ICON: Record<Tone, IconName> = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' }

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((message: string, tone: Tone = 'info') => {
    const id = uid('toast')
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const value = useMemo(() => notify, [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`}>
            <Icon name={ICON[t.tone]} size={16} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
