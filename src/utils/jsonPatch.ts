import type { JsonPatchOp } from '@/types/agui'

type Container = Record<string, unknown> | unknown[]

const decode = (seg: string) => seg.replace(/~1/g, '/').replace(/~0/g, '~')

export const parsePointer = (path: string): string[] => (path === '' ? [] : path.split('/').slice(1).map(decode))

/** Minimal RFC 6902 (add / replace / remove) — returns a new document. */
export function applyPatch<T>(doc: T, ops: JsonPatchOp[]): T {
  let root: unknown = structuredClone(doc)
  for (const op of ops) root = applyOp(root, op)
  return root as T
}

function applyOp(root: unknown, op: JsonPatchOp): unknown {
  const keys = parsePointer(op.path)
  if (keys.length === 0) return op.op === 'remove' ? undefined : op.value

  let parent = root as Container
  for (const key of keys.slice(0, -1)) {
    const next = (parent as Record<string, unknown>)[key]
    if (next === undefined || next === null) {
      if (op.op === 'remove') return root
      ;(parent as Record<string, unknown>)[key] = {}
    }
    parent = (parent as Record<string, unknown>)[key] as Container
  }

  const last = keys[keys.length - 1]
  if (Array.isArray(parent)) {
    const idx = last === '-' ? parent.length : Number(last)
    if (op.op === 'add') parent.splice(idx, 0, op.value)
    else if (op.op === 'replace') parent[idx] = op.value
    else parent.splice(idx, 1)
  } else if (op.op === 'remove') {
    delete parent[last]
  } else {
    parent[last] = op.value
  }
  return root
}

/** Read a value from an object by JSON pointer ("/user/email"). */
export function getAt(obj: unknown, path: string): unknown {
  return parsePointer(path).reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  )
}

/** Immutable set by JSON pointer. */
export function setAt<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  return applyPatch(obj, [{ op: 'add', path, value }])
}
