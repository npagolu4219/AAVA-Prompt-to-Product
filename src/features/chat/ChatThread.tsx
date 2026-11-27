import { memo, useState } from 'react'
import { useRun } from '@/app/providers/RunProvider'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { ResourceKind } from '@/types/resources'
import { Markdown } from '@/components/ui/Markdown'
import { useStickToBottom } from '@/hooks'
import type { ChatMessage } from '@/types/run'
import { cx } from '@/utils/format'
import styles from './Chat.module.scss'

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** Conversation stream fed by AG-UI TEXT_MESSAGE_* events. */
export function ChatThread() {
  const { state } = useRun()
  const last = state.messages[state.messages.length - 1]
  const { ref, atBottom, scrollToBottom } = useStickToBottom<HTMLDivElement>(`${state.messages.length}:${last?.content.length}:${state.interrupt?.id}`)
  const thinking = state.status === 'running' && !last?.streaming
  const activeStep = state.steps.find((s) => s.status === 'running')
  // The typing row continues the agent's turn when the last bubble was already the agent's.
  const thinkingContinues = last?.role === 'assistant'

  return (
    <div className={styles.threadWrap}>
      <div ref={ref} className={styles.thread} role="log" aria-live="polite" aria-label="Conversation">
        {state.messages.length === 0 && !thinking && <ThreadEmpty />}
        {state.messages.map((m, i) => (
          <Message key={m.id} message={m} startsGroup={startsGroup(m, prevSpeaker(state.messages, i))} />
        ))}
        {thinking && (
          <div className={cx(styles.msg, styles.assistant, !thinkingContinues && styles.groupStart)}>
            <span className={cx(styles.avatar, thinkingContinues && styles.avatarHidden)} aria-hidden>
              <Icon name="sparkles" size={14} />
            </span>
            <div className={styles.working} aria-label="Agent is working">
              <span className={styles.dots}>
                <span />
                <span />
                <span />
              </span>
              {activeStep ? `${activeStep.name}…` : 'Working…'}
            </div>
          </div>
        )}
      </div>
      {!atBottom && (
        <button type="button" className={styles.jump} onClick={scrollToBottom}>
          <Icon name="arrowDown" size={13} /> Latest
        </button>
      )}
    </div>
  )
}

/** A new visual group starts when the speaker changes; consecutive agent messages share one avatar. */
const startsGroup = (m: ChatMessage, prev?: ChatMessage) => !prev || prev.role === 'system' || prev.role !== m.role

/** The previous message that has a speaker; "grounded on" cards sit inside the agent's turn. */
function prevSpeaker(messages: ChatMessage[], i: number) {
  for (let j = i - 1; j >= 0; j--) if (!messages[j].context?.length) return messages[j]
  return undefined
}

function ThreadEmpty() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden>
        <Icon name="sparkles" size={18} />
      </span>
      <p className={styles.emptyTitle}>Describe what you want to build</p>
      <p className={styles.emptyText}>
        The agent plans the screen, asks you to approve key decisions, then builds and verifies it. Type <kbd>@</kbd> to reference your context.
      </p>
    </div>
  )
}

const KIND_ICON: Record<ResourceKind, IconName> = { codebase: 'gitBranch', figma: 'figma', 'design-system': 'palette', openapi: 'api', docs: 'book', upload: 'upload' }

const Message = memo(function Message({ message: m, startsGroup }: { message: ChatMessage; startsGroup: boolean }) {
  if (m.context?.length) return <ContextCard message={m} />

  if (m.role === 'system') {
    return (
      <div className={cx(styles.system, m.tone && styles[m.tone])} role="note">
        <Icon name={m.tone === 'danger' || m.tone === 'warning' ? 'alert' : m.tone === 'success' ? 'check' : 'info'} size={13} />
        <Markdown variant="chat">{m.content}</Markdown>
      </div>
    )
  }

  if (m.role === 'user') {
    return (
      <div className={cx(styles.msg, styles.user, startsGroup && styles.groupStart)}>
        <div className={styles.bubble}>
          <Markdown variant="chat">{m.content}</Markdown>
        </div>
        {startsGroup && <span className={styles.meta}>You · {timeOf(m.createdAt)}</span>}
      </div>
    )
  }

  return (
    <div className={cx(styles.msg, styles.assistant, startsGroup && styles.groupStart)}>
      <span className={cx(styles.avatar, !startsGroup && styles.avatarHidden)} aria-hidden>
        <Icon name="sparkles" size={14} />
      </span>
      <div className={styles.body}>
        {startsGroup && (
          <span className={styles.meta}>
            <strong>AAVA agent</strong> · {timeOf(m.createdAt)}
          </span>
        )}
        <div className={cx(styles.text, m.streaming && styles.streaming)}>
          <Markdown variant="chat">{m.content || ' '}</Markdown>
        </div>
        {!m.streaming && m.content && <CopyButton text={m.content} />}
      </div>
    </div>
  )
})

function ContextCard({ message: m }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false)
  const ctx = m.context ?? []
  return (
    <div className={cx(styles.contextCard, open && styles.contextOpen)}>
      <button type="button" className={styles.contextHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="layers" size={13} />
        <span>
          Grounded on {ctx.length} source{ctx.length > 1 ? 's' : ''}
        </span>
        <span className={styles.contextPeek}>{ctx.map((c) => c.name).join(' · ')}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={13} className={styles.contextChev} />
      </button>
      {open && (
        <ul>
          {ctx.map((c, i) => (
            <li key={i}>
              <span className={styles.contextChip}>
                <Icon name={KIND_ICON[c.kind]} size={12} />
                {c.name}
              </span>
              <span className={styles.contextDetail}>{c.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={copy} aria-label={copied ? 'Copied' : 'Copy message'} title={copied ? 'Copied' : 'Copy'}>
        <Icon name={copied ? 'check' : 'copy'} size={12} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
