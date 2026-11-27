import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '@/hooks'
import { cx } from '@/utils/format'
import { IconButton } from './Button'
import styles from './Drawer.module.scss'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  side?: 'right' | 'left'
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
}

/** Side sheet on desktop, bottom sheet on phones (pure CSS switch). */
export function Drawer({ open, onClose, title, subtitle, side = 'right', wide, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEscape(open, onClose)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
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
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div ref={panelRef} className={cx(styles.panel, styles[side], wide && styles.wide)} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <span className={styles.grabber} aria-hidden />
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
