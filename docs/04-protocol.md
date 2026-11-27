# 04 · AG-UI & A2UI protocol

The UI and the agent backend share exactly two contracts:

- **AG-UI** carries everything that *happens* during a run: lifecycle, text, tool calls, shared state and custom events.
- **A2UI v0.9** carries the *generated UI*, as declarative components only. No executable code crosses this boundary.

Types live in [`types/agui.ts`](../src/types/agui.ts) and [`types/a2ui.ts`](../src/types/a2ui.ts). Events are applied by `reduceEvent()` in [`state/runReducer.ts`](../src/state/runReducer.ts).

## Backend contract (HTTP)

`HttpAgentClient` is used when `VITE_AGENT_URL` is set ([`services/agent/HttpAgentClient.ts`](../src/services/agent/HttpAgentClient.ts)).

| Request | Body | Response |
|---|---|---|
| `POST {VITE_AGENT_URL}` | AG-UI `RunAgentInput` (below) | `text/event-stream`: one JSON AG-UI event per `data:` frame |
| `POST {VITE_AGENT_URL}/resume` | `HitlDecision` `{ interruptId, decision: "approve" \| "edit" \| "reject", note? }` | any 2xx |
| `POST {VITE_AGENT_URL}/refine` *(optional)* | `{ prompt, mode, context: { dbName, handles } }` | `{ text, changes?, pattern? }`; the client falls back to the local refiner on error |

`RunAgentInput` as sent:

```jsonc
{
  "threadId": "thread_…",
  "runId": "run_…",
  "messages": [{ "id": "msg_…", "role": "user", "content": "Revenue dashboard with KPIs" }],
  "state": {}, "tools": [], "context": [],
  "forwardedProps": {
    "mode": "full",                 // or "refine"
    "figma": { "url": "…", "token": "…" },   // BFF must move the token to a vault and strip it before any LLM call
    "options": { "autoApprovePlan": false, "speed": 1 },
    "refine": { /* RefineContext: scenarioId, components, dataModel, version, quality, files, changelog, bindings */ }
  }
}
```

> The mock client receives the full `RunInput`, which adds `screen` (reserved id, slug and index), `project` (other screens and their primary actions), `dataSource` and `resources`. A real BFF should accept the same fields in `forwardedProps`.

## Event reference

| Event | Fields | Effect in the UI |
|---|---|---|
| `RUN_STARTED` | `threadId, runId, mode` | Status → running; steps reset; telemetry reset |
| `RUN_FINISHED` | `threadId, runId` | Status → finished; triggers autosave and the ledger row |
| `RUN_ERROR` | `message` | Status → error; running step marked error; danger message in chat; an empty placeholder screen is removed |
| `STEP_STARTED` | `stepName` | Step → running; iteration count +1 (Verify shows ×2) |
| `STEP_FINISHED` | `stepName, summary?` | Step → done with its summary line |
| `TEXT_MESSAGE_START/CONTENT/END` | `messageId, delta` | Streams an assistant chat bubble (Markdown) |
| `TOOL_CALL_START` | `toolCallId, toolCallName, parentStepName?` | Adds a running tool row under the step |
| `TOOL_CALL_END` | `toolCallId, result?` | Marks the tool done with its result text |
| `STATE_SNAPSHOT` | `snapshot: SharedState` | Replaces the run screen's shared state |
| `STATE_DELTA` | `delta: JsonPatchOp[]` | JSON-patches shared state (`/files`, `/spec`, `/quality`, `/version`, `/changelog`, `/bindings`, `/previousFiles`) |
| `CUSTOM a2ui` | `A2uiMessage[]` | Folded into the run screen's surface (Preview updates live) |
| `CUSTOM interrupt` | `Interrupt` | Status → waiting; HITL card shown; human wait timer starts |
| `CUSTOM step_skipped` | `{ stepName, reason }` | Step → skipped with reason |
| `CUSTOM screen_link` | `{ fromScreenId, action, label }` | Links the previous screen's action to the screen being built |
| `CUSTOM context_used` | `ContextUse[]` | "Grounded on" card in chat |
| `CUSTOM usage` | `UsageEntry` | Appended to run telemetry (tokens, cost, latency) |

All events after `RUN_STARTED` apply to the **run screen** (`runScreenId`), not to whichever screen the user is viewing. That is why the user can browse other screens while one is building.

### Shared state (`SharedState`)

```ts
{
  scenarioId: string | null   // pattern used (or generic-<slug>)
  title: string
  version: number             // v1 initial, +1 per fix/refine/binding
  files: GenFile[]            // { path, language, content }
  previousFiles: GenFile[]    // for Diff
  spec: string                // Markdown spec
  quality: QualityReport | null
  changelog: string[]
  bindings: CollectionBinding[]   // componentId.prop ← table (source, rowCount)
}
```

> A `STATE_DELTA` that replaces `/files` clears the screen's `editedPaths`, so regenerated code supersedes hand edits made in the Code tab. Edits made after the last regeneration are kept and exported.

### Interrupts (HITL)

```ts
interface Interrupt {
  id: string
  kind: 'plan' | 'final' | 'escalation'
  checkpoint: 1 | 2 | 3          // ① plan · ② final sign-off · ③ escalation
  title: string; body: string; details?: string[]
  options: ('approve' | 'edit' | 'reject')[]
  labels?: { approve?: string; edit?: string; reject?: string }   // e.g. "Sign off", "Keep as is"
}
```

The client answers with `resolveInterrupt({ interruptId, decision, note })`. `edit` always carries the reviewer's note.

### Usage telemetry

```ts
interface UsageEntry { agent; step; tier: 'small'|'medium'|'large'|'none'; inputTokens; outputTokens; cachedTokens; latencyMs }
```

Deterministic agents (`tier: 'none'`) report 0 tokens but still report latency.

## A2UI v0.9

### Messages

```ts
{ version: 'v0.9', createSurface:    { surfaceId, catalogId? } }       // starts a surface (catalog 'aava-play@1')
{ version: 'v0.9', updateComponents: { surfaceId, components: A2uiComponent[] } }  // upsert by id
{ version: 'v0.9', updateDataModel:  { surfaceId, path, value } }      // '' or '/' replaces the whole model
{ version: 'v0.9', deleteSurface:    { surfaceId } }
```

`processA2uiMessages()` in [`state/a2uiProcessor.ts`](../src/state/a2uiProcessor.ts) is a pure fold over these messages. Updates for a surface that doesn't exist are ignored. Each `updateComponents` batch increments `revision`.

### Components

```jsonc
{ "id": "root",  "component": "Column", "align": "center", "maxWidth": 420, "children": ["card"] }
{ "id": "email", "component": "AavaTextField", "label": "Email", "value": { "path": "/form/email" } }
{ "id": "cta",   "component": "AavaButton", "label": "Sign in", "variant": "primary",
  "action": { "event": { "name": "signIn", "context": { "email": { "path": "/form/email" } } } } }
```

- A component is a flat record (`id`, `component`, `children[]`, plus props). The tree is rebuilt from the `root` id.
- A prop can be a literal or a **data binding** `{ "path": "/…" }` into the data model. Inputs write back through the binding (two-way).
- **Actions** (`{ event: { name, context } }`) are sent back to the agent. If the action is linked in the Flow, it navigates to the linked screen instead (prototype mode).

### The AAVA Play catalog

19 components are allowed ([`features/canvas/preview/catalog`](../src/features/canvas/preview/catalog/index.ts)):

| Layout | Content | Inputs | Actions | Data display |
|---|---|---|---|---|
| Column, Row, Grid | AavaCard, AavaHeading, AavaText, AavaBadge, AavaDivider, AavaAvatar | AavaTextField, AavaCheckbox, AavaToggle, AavaSelect | AavaButton, AavaLink | AavaStatCard, AavaBarChart, AavaTable, AavaList |

Any other `component` value is **blocked**: it renders as a visible "not in catalog" placeholder, is reported by `a2ui.validate` and Design Lint, and is flagged by code analysis (`DS-COMP-03`).

## Writing a compatible backend: checklist

1. Stream SSE frames `data: {json}\n\n`, one AG-UI event per frame.
2. Emit `RUN_STARTED` first and `RUN_FINISHED` (or `RUN_ERROR`) last.
3. Wrap work in `STEP_STARTED`/`STEP_FINISHED` using the 8 step names. Use `step_skipped` for steps you don't run.
4. Send a `STATE_SNAPSHOT` early, then `STATE_DELTA` patches.
5. Send UI only as `CUSTOM a2ui` messages, using only catalog components.
6. For HITL, emit `CUSTOM interrupt` and block until `/resume` arrives with the matching `interruptId`.
7. Emit `CUSTOM usage` per LLM call so the ROI dashboard has real cost data.
8. On Deliver, emit `screen_link` from the previous screen's primary action. That screen's id comes in `forwardedProps`.
