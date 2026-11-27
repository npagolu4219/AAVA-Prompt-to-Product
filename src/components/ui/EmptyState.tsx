import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './EmptyState.module.scss'

interface Props {
  icon: IconName
  title: string
  description?: ReactNode
  children?: ReactNode
}

export function EmptyState({ icon, title, description, children }: Props) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon}>
        <Icon name={icon} size={26} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  )
}
