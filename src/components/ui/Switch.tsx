import { useId } from 'react'
import styles from './Switch.module.scss'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const id = useId()
  return (
    <label className={styles.row} htmlFor={id}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" className={styles.input} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track} aria-hidden>
        <span className={styles.thumb} />
      </span>
    </label>
  )
}
