# 10 · Developer guide

## Setup

```bash
npm install
npm run dev       # http://localhost:5173 (Vite)
npm run build     # tsc -b (strict type-check) + production build → dist/
npm run preview   # serve dist/
npm run lint      # oxlint
```

Requirements: Node 20+.

- **TypeScript settings:** strict, `verbatimModuleSyntax` and `erasableSyntaxOnly`. Use `import type` for type-only imports, and don't use `enum` or `namespace`.
- **Path alias:** `@/` → `src/`.

## Environment variables

All variables are optional. Without them, everything runs offline on mock services and demo data.

| Variable | Effect |
|---|---|
| `VITE_AGENT_URL` | Use `HttpAgentClient` (AG-UI over SSE) instead of the mock agent; also enables `POST {url}/refine` for prompt refine. Contract: [04](04-protocol.md) |
| `VITE_DATA_API_URL` | Use `HttpDataSourceClient`: `GET /sources/:id/tables`, `GET /sources/:id/tables/:name?limit=` |
| `VITE_PUBLISH_URL` | Use `HttpPublishClient`: `POST /deployments` with the project ZIP |

(`VITE_API_URL` appears only inside *exported* React/Vue projects, where it is the data API base URL.)

## Conventions

- **Features own their UI:** `features/<area>/Thing.tsx` + `Thing.module.scss`. Shared primitives go in `components/ui`.
- **Logic goes in services** as pure TypeScript with no React. Reducers and engines are pure functions with no I/O.
- **One provider per concern,** exposed as a `useX()` hook that throws outside its provider.
- **Styles** use theme tokens only. Never hard-code colours; use `color-mix` with tokens for tints. Spacing uses `sp()`. Every interactive element needs a `focus-ring`.
- **Accessibility:** labelled controls, `aria-current`/`aria-pressed`/`aria-expanded` where relevant, keyboard paths (Esc closes, arrow keys in menus), reduced-motion support.
- **Never persist secrets** (tokens, passwords).

## Extension recipes

### Add a built-in screen pattern (scenario)

1. Create it with `defineScenario({...})` in `src/data/scenarios/` (see `more.ts` for compact examples). Provide `id`, `slug`, `title`, `keywords`, `intent`, `plan`, `components`, `dataModel`, and optionally `dataNeeds`, `states`, `responsive`, `quality`, `fixes` and `defects`. `define.ts` fills defaults, including a shortlist derived from the components used.
2. Register it in `BUILT_IN_SCENARIOS` in [`data/scenarios/index.ts`](../src/data/scenarios/index.ts). The order is the suggested flow order.
3. It automatically works in the pipeline, the landing templates, prompt refine, export and the ROI complexity calculation.

### Add a catalog component

1. Implement the React stand-in in `features/canvas/preview/catalog/components.tsx`, then register it in `AAVA_PLAY_CATALOG` ([`catalog/index.ts`](../src/features/canvas/preview/catalog/index.ts)).
2. Map it in the **Angular codegen** (`services/codegen/angular.ts`, the `switch` on `component`).
3. Map it in the **IR** (`services/export/ir.ts`) so React, Vue and HTML exports render it, and add portable CSS in `services/export/css.ts`.
4. Add it to the portable Angular kit (`services/export/angularKit.ts`).
5. If it shows a collection, add it to `PROP_FOR` in `services/datasource/bindings.ts`.

### Add an export stack

Add a `StackMeta` to `STACKS` and a builder `(opts, screens, theme) => { files, notes }` in [`services/export/stacks.ts`](../src/services/export/stacks.ts), then wire it into `buildProject`. Reuse `commonFiles()` for README, env, Docker, CI and deploy configs.

### Add a cloud provider

Add the provider fields to `PROVIDER_FIELDS` and the file generation to `generateDeployConfig()` in [`services/publish/deployConfig.ts`](../src/services/publish/deployConfig.ts), and add it to `PROVIDERS` in `services/publish/publish.ts`.

### Add an agent or tool to the pipeline

- **Mock:** in [`mock/flows.ts`](../src/services/agent/mock/flows.ts), call `h.tool({ name, ms, result })` inside the right `h.step(...)`, and report tokens with `h.usage('<Agent>', in, out)`.
- **Register** the agent's model tier in `AGENT_TIERS` ([`config/roi.ts`](../src/config/roi.ts)) so its cost is tracked.
- **Real backend:** emit the same `TOOL_CALL_*` and `CUSTOM usage` events. The UI needs no changes.

### Add a refinement intent (mock)

Add a rule to `applyRefinement()` in [`mock/refinements.ts`](../src/services/agent/mock/refinements.ts). Match the text, push JSON-patch ops, add the changed components, and push a human-readable note.

### Add a page

Add the route to the `Route` union and `useHashRoute()` in `features/nav/routing.ts`, render it in `Workspace.tsx`, and add a nav item in `AppNav.tsx` (in the *Build* or *Insights* group).

## Connecting a real backend: suggested order

1. **Agent BFF** implementing [04](04-protocol.md): start by replaying the mock's event sequence, then replace each step with real agents.
2. **Vault** for Figma, database and cloud tokens. The browser only ever sends them per request.
3. **Data API** (`VITE_DATA_API_URL`) behind the BFF, with read-only credentials.
4. **Publish service** (`VITE_PUBLISH_URL`) that builds the ZIP in CI and deploys.
5. Calibrate the ROI assumptions with pilot timesheets.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Clicks seem ignored right after navigating | A view transition is running (≈ 0.4–0.7 s). Wait for it, or turn on reduce motion |
| Exported Angular `npm install` fails with E502 / 401 | *Registry* mode needs access to the private `@aava/play` registry. Use the default **portable kit** |
| Refine says it "couldn't map that" | The mock Fixer supports only the listed intents. Use a suggestion chip, or connect a real backend |
| Prompt refine builds the wrong screen | Keep the brief's first line ("Pattern — …"); it selects the pattern |
| Hand edits in the Code tab disappeared | A later regeneration (refine, auto-fix, data binding) replaced the files. Re-apply the edit after the last change |
| History is empty on another browser or device | History lives in that browser's IndexedDB |
