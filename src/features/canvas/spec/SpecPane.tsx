import { useRun } from '@/app/providers/RunProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Markdown } from '@/components/ui/Markdown'
import { downloadText } from '@/services/export/zipExport'
import styles from './SpecPane.module.scss'

/** Generated screen spec + audit report, rendered as markdown. */
export function SpecPane() {
  const { activeScreen } = useRun()
  const notify = useToast()
  const { spec = '', version = 0, quality = null } = activeScreen?.shared ?? {}

  if (!spec) {
    return <EmptyState icon="fileText" title="No spec yet" description="The spec and audit report are compiled from the A2UI tree during the Act step, then updated after every verification." />
  }

  const slug = activeScreen?.slug ?? 'screen'

  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        <Badge tone="primary" size="sm" icon="fileText">
          {slug}.spec.md
        </Badge>
        <Badge size="sm">v{version}</Badge>
        {quality && (
          <Badge size="sm" tone={quality.decision === 'deliver' ? 'success' : quality.decision === 'autofix' ? 'warning' : 'danger'}>
            audit {quality.score.toFixed(2)}
          </Badge>
        )}
        <span className={styles.spacer} />
        <Button
          size="sm"
          variant="ghost"
          icon="copy"
          onClick={() => {
            void navigator.clipboard?.writeText(spec)
            notify('Spec copied', 'success')
          }}
        >
          <span className={styles.hideXs}>Copy</span>
        </Button>
        <Button size="sm" icon="download" onClick={() => downloadText(spec, `${slug}.spec.md`)}>
          <span className={styles.hideXs}>.md</span>
        </Button>
      </div>
      <article className={styles.doc}>
        <Markdown>{spec}</Markdown>
      </article>
    </div>
  )
}
