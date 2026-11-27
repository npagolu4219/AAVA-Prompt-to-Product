import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/utils/format'
import styles from './LiveCode.module.scss'

const TOKEN =
  /(\/\/.*$|<!--.*?-->)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|\b(import|from|export|class|const|let|readonly|return|private|public|void|this|if|else|new|extends|implements|true|false|null|undefined|async|await|type|interface)\b|(\b\d+(?:\.\d+)?\b)|(<\/?[a-z][\w-]*|\/?>)|([▸✓⟳])/g

/** Tiny, dependency-free highlighter for JSON / TS / HTML / log lines. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of line.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push(line.slice(last, at))
    const [text, comment, str, kw, num, tag, mark] = m
    const isKey = str && line.slice(at + text.length).trimStart().startsWith(':')
    const cls = comment ? styles.comment : str ? (isKey ? styles.key : styles.string) : kw ? styles.keyword : num ? styles.number : tag ? styles.tag : mark ? styles.mark : undefined
    out.push(
      <span key={i++} className={cls}>
        {text}
      </span>,
    )
    last = at + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

interface Props {
  text: string
  /** Animate typing while true; show everything instantly when false. */
  typing: boolean
  title?: string
  caption?: string
  className?: string
  compact?: boolean
}

/** Streams `text` like a fast typist, keeping up as the source grows. */
export function LiveCode({ text, typing, title, caption, className, compact }: Props) {
  const [n, setN] = useState(typing ? 0 : text.length)
  const target = useRef(text.length)
  const scroller = useRef<HTMLPreElement>(null)
  target.current = text.length

  useEffect(() => {
    if (!typing) return
    let raf = 0
    const tick = () => {
      setN((cur) => {
        const goal = target.current
        if (cur >= goal) return cur
        return Math.min(goal, cur + Math.max(3, Math.ceil((goal - cur) / 28)))
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [typing])

  const shown = typing ? text.slice(0, Math.min(n, text.length)) : text
  const lines = shown.split('\n')

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && typing) el.scrollTop = el.scrollHeight
  }, [shown, typing])

  return (
    <div className={cx(styles.panel, compact && styles.compact, className)}>
      {(title || caption) && (
        <header className={styles.head}>
          <span className={styles.dots} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {title && <span className={styles.title}>{title}</span>}
          {caption && <span className={styles.caption}>{caption}</span>}
        </header>
      )}
      <pre ref={scroller} className={styles.code} aria-live="off">
        {lines.map((l, i) => (
          <div key={i} className={styles.line}>
            {!compact && <span className={styles.ln}>{i + 1}</span>}
            <span className={styles.src}>
              {highlight(l)}
              {typing && i === lines.length - 1 && <span className={styles.caret} aria-hidden />}
            </span>
          </div>
        ))}
      </pre>
    </div>
  )
}
