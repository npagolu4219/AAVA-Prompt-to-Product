import type { ReactNode } from 'react'
import { cx } from '@/utils/format'
import { Icon, type IconName } from './Icon'
import styles from './Badge.module.scss'

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  tone?: BadgeTone
  icon?: IconName
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
  title?: string
}

export function Badge({ tone = 'neutral', icon, dot, size = 'md', className, children, title }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[size], className)} title={title}>
      {dot && <span className={styles.dot} aria-hidden />}
      {icon && <Icon name={icon} size={size === 'sm' ? 11 : 13} strokeWidth={2.4} />}
      {children}
    </span>
  )
}
