import type { ReactNode } from 'react'
import { IconButton } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useOpenNav } from './routing'
import styles from './PageHeader.module.scss'

interface Props {
  icon: IconName
  title: string
  subtitle?: string
  actions?: ReactNode
}

/** Header for full pages (Context, History): menu button on phones, title, actions. */
export function PageHeader({ icon, title, subtitle, actions }: Props) {
  const openNav = useOpenNav()
  return (
    <header className={styles.head}>
      <IconButton icon="menu" label="Open navigation" className={styles.menu} onClick={openNav} />
      <span className={styles.icon} aria-hidden>
        <Icon name={icon} size={20} />
      </span>
      <div className={styles.titles}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
