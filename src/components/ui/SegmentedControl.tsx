import { useId } from 'react'
import { cx } from '@/utils/format'
import { Icon, type IconName } from './Icon'
import styles from './SegmentedControl.module.scss'

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  icon?: IconName
  hideLabel?: boolean
}

interface Props<T extends string | number> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  block?: boolean
}

/** Accessible radio-group styled as a segmented control. */
export function SegmentedControl<T extends string | number>({ value, options, onChange, label, size = 'md', block }: Props<T>) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.group, styles[size], block && styles.block)}>
      {options.map((o) => {
        const checked = o.value === value
        return (
          <label key={String(o.value)} className={cx(styles.option, checked && styles.checked)} title={o.hideLabel ? o.label : undefined}>
            <input type="radio" name={name} className={styles.input} checked={checked} onChange={() => onChange(o.value)} aria-label={o.label} />
            {o.icon && <Icon name={o.icon} size={size === 'sm' ? 14 : 15} />}
            {!o.hideLabel && <span>{o.label}</span>}
          </label>
        )
      })}
    </div>
  )
}
