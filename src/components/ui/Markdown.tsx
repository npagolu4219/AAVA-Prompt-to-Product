import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cx } from '@/utils/format'
import styles from './Markdown.module.scss'

interface Props {
  children: string
  variant?: 'document' | 'chat'
  className?: string
}

/** GitHub-flavoured markdown with workspace typography. Raw HTML is never rendered. */
export function Markdown({ children, variant = 'document', className }: Props) {
  return (
    <div className={cx(styles.md, styles[variant], className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
