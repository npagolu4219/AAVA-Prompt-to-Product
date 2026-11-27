import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '@/hooks'
import { cx } from '@/utils/format'
import { IconButton } from './Button'
import { Icon, type IconName } from './Icon'
import styles from './Modal.module.scss'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: IconName
  size?: 'md' | 'lg'
  steps?: string[]
  step?: number
  children: ReactNode
  footer?: ReactNode
  /** Prevent closing (e.g. mid-deploy). */
  locked?: boolean
  /** Body without padding (content manages its own layout, e.g. wizards). */
  flush?: boolean
}

/** Centred dialog on desktop, full-height sheet on phones. Optional stepper header. */
export function Modal({ open, onClose, title, subtitle, icon, size = 'lg', steps, step = 0, children, footer, locked, flush }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEscape(open && !locked, onClose)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={styles.root}>
      <div className={styles.overlay} onClick={locked ? undefined : onClose} aria-hidden />
      <div ref={ref} className={cx(styles.panel, styles[size])} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <header className={styles.header}>
          {icon && (
            <span className={styles.icon} aria-hidden>
              <Icon name={icon} size={18} />
            </span>
          )}
          <div className={styles.titles}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} disabled={locked} />
        </header>
        {steps && (
          <ol className={styles.steps} aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s} className={cx(styles.step, i < step && styles.stepDone, i === step && styles.stepCurrent)} aria-current={i === step ? 'step' : undefined}>
                <span className={styles.stepNum}>{i < step ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
                <span className={styles.stepLabel}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
