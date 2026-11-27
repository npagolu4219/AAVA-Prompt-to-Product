import { useMemo, useState } from 'react'
import { IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useOpenNav } from '@/features/nav/routing'
import type { FigmaRef } from '@/types/run'
import { LandingPrompt } from './LandingPrompt'
import { getTemplates } from './templates'
import styles from './LandingPage.module.scss'

interface Props {
  onSubmit: (prompt: string, figma?: FigmaRef) => void
  onOpenData: () => void
}

export function LandingPage({ onSubmit, onOpenData }: Props) {
  const openNav = useOpenNav()
  const [prompt, setPrompt] = useState('')
  const templates = useMemo(() => getTemplates(), [])

  return (
    <div className={styles.page}>
      <div className={styles.bg} aria-hidden>
        <span className={styles.blobA} />
        <span className={styles.blobB} />
        <span className={styles.gridBg} />
      </div>

      {/* The left nav carries brand + global actions; phones get a floating menu button to open it. */}
      <IconButton icon="menu" label="Open navigation" variant="secondary" className={styles.menuFab} onClick={openNav} />

      <main id="top">
        <section className={styles.hero}>
          <span className={styles.pill}>
            <span className={styles.pillTag}>New</span> Multi-screen flows · DB import · one-click publish
          </span>
          <h1 className={styles.h1}>
            Describe it. <span className={styles.grad}>Watch it build.</span>
            <br />
            Ship verified UI.
          </h1>
          <p className={styles.lead}>Agents plan, compose and verify on-brand screens from AAVA Play — live, step by step — then hand you production code for the stack you choose.</p>

          <LandingPrompt value={prompt} onChange={setPrompt} onSubmit={onSubmit} onOpenData={onOpenData} />

          <div className={styles.chips} aria-label="Quick starts">
            {templates.slice(0, 5).map((t) => (
              <button key={t.id} type="button" className={styles.chip} onClick={() => setPrompt(t.prompt)}>
                <Icon name="sparkles" size={12} /> {t.title}
              </button>
            ))}
          </div>

          <ul className={styles.stats}>
            <li>
              <strong>8</strong> agent stages
            </li>
            <li>
              <strong>10</strong> screens per flow
            </li>
            <li>
              <strong>4</strong> code stacks
            </li>
            <li>
              <strong>0</strong> hard-gate escapes
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
