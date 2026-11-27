import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/utils/format'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, !children && styles.iconOnly, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon && <Icon name={icon} size={iconSize} />}
      {children && <span className={styles.label}>{children}</span>}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
})

interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children'> {
  icon: IconName
  label: string
}

/** Square icon-only button; `label` is required for screen readers + tooltip. */
export function IconButton({ icon, label, variant = 'ghost', ...rest }: IconButtonProps) {
  return <Button icon={icon} variant={variant} aria-label={label} title={label} {...rest} />
}
