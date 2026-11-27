# AAVA Prompt-to-Product (React)

A React + TypeScript + SCSS implementation of the **AAVA Prompt-to-Product** workspace: a prompt or Figma frame goes in, and verified, design-system-compliant Angular UI comes out. The run goes through the full **Sense → Match → Mind → Think → Act → Verify → Refine** loop, with human-in-the-loop checkpoints along the way.

Everything runs on **dummy data** through a mock AG-UI agent, so the whole flow works offline. Set one environment variable to point it at a real AG-UI endpoint.

## Documentation

Full documentation lives in [`docs/`](docs/README.md): overview, architecture, the **agent pipeline** (all 12 agents, HITL checkpoints, quality gates), the AG-UI/A2UI protocol, state, codegen/export/publish, data and context, ROI, theming, a developer guide and a user guide.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

## ROI & business value (`#/roi`)

- **Telemetry:**
  - Every agent reports LLM usage over AG-UI (`CUSTOM "usage"`): tokens in and out, cached tokens and latency, using the deck's tier mapping. Deterministic agents report zero tokens.
  - The reducer also measures human time at HITL checkpoints (interrupt → decision) and the gaps found before auto-fix.
- **Ledger:** each run writes one `RunRecord` when it ends (delivered, draft, escalated, cancelled or error) to `localStorage` (`LedgerProvider`).
- **Value engine** (`services/roi/engine.ts`, pure functions):
  - labour saved = Σ role (baseline − actual hours) × rate
  - defects avoided
  - AI spend (cache-aware tier pricing)
  - platform + amortised build cost
  - net value, ROI and payback
  - full-code token baseline
  - review-ready DS compliance
- **Dashboard:**
  - KPIs
  - value bridge
  - cumulative value vs investment
  - six baseline-vs-actual comparisons
  - hours by role
  - AI usage (tokens, cache hit rate, daily spend vs budget, spend by tier and by agent)
  - project-wise table with click-to-focus and CSV export
  - period and project filters
  - methodology notes
- **Assumptions drawer:** rates, baseline and remaining effort by complexity, lead times, model pricing per tier, platform/build/budget, defect cost and full-code token model. Edits are applied live and persisted.
- **Sample data:** deterministic sample data (5 projects) makes the dashboard explorable on day one. It is flagged `sample`, never saved, and can be turned off with one switch.
- **Charts:** dependency-free SVG using the dataviz reference palette, validated for colour-vision deficiency in light and dark mode.

## Navigation, context resources & chat history

- **Left nav** (`features/nav`): Home · Studio · Context · History, plus New chat, Data sources and Theme.
  - Desktop: an expandable rail; the expanded state shows recent chats.
  - Tablet: collapsed to icons.
  - Phones: an off-canvas drawer, opened from each page's menu button.
  - Hash routes (`#/`, `#/studio`, `#/resources`, `#/history`) make back/forward and deep links work.
- **Context & resources** (`#/resources`) supports six kinds of source:
  - org **codebases** (GitHub, GitLab, Bitbucket or Azure DevOps · branch · include paths)
  - **Figma libraries**
  - **design-system docs**
  - **OpenAPI specs**
  - **knowledge docs** (Confluence, Notion, SharePoint)
  - **file uploads**, which are read locally in the browser
- **How resources work:**
  - Each source is indexed with progress and stats, can be toggled on or off, re-indexed, edited or removed.
  - Tokens are never persisted.
  - Enabled sources ground every run: the agent calls `codebase.search`, `figma.library`, `docs.retrieve` and `openapi.match`, and the chat shows a **"Grounded on"** card listing what was used.
  - **`@mention`** any resource in the composer (with autocomplete) to include it even when it's turned off.
  - The spec lists the sources the screen was grounded on.
- **Chat history** (`#/history`):
  - Conversations, including screens, code, specs and quality reports, are autosaved to **IndexedDB** after each run.
  - You can search, reopen, rename and delete them, see totals, and re-run the pilot sample runs.
  - History survives a page reload.
- **Responsive:** verified at 320, 390, 600, 768, 1024, 1280 and 1920 px on every page, with no horizontal page scroll.

## Landing page & build theatre

- **Landing** (`features/landing`) is a single hero:
  - a typewriter prompt bar with an animated gradient border
  - **Refine** (wand, ⌘/Ctrl+I): rewrites the idea into a build-ready brief (Enhance · Make concise · Accessibility · Bind to data), with undo
  - an optional Figma source, a database chip and a context chip
  - quick-start chips and headline stats
- **Transition:** submitting starts the run and morphs the prompt bar into the studio composer using the **View Transitions API** (`view-transition-name: aava-prompt`). The studio panes then slide in. Browsers without the API, and users with reduced motion, get a simple fade.
- **Build theatre** in Preview, driven by AG-UI step events (`useBuildPhase`):
  1. **Planning:** a blueprint wireframe assembles with a scanning beam, alongside a live step checklist and a typed `agent.log` of tool calls.
  2. **Composing:** A2UI components stream in **one by one**, and each node rises into place. A **Live code** panel types the A2UI JSON, then the compiled Angular `.ts` and `.html`.
  3. **Verifying:** a scan line sweeps the frame while four verifier pills show critic, a11y, lint and Playwright progress.
  - A progress header runs throughout, and the canvas snaps to Preview whenever a new screen starts building.

## What's new: multi-screen projects, DB import, stack export, cloud publish

| Capability | Where | How it works |
| --- | --- | --- |
| **Up to 10 screens in one chat** | Composer mode toggle (*New screen n/10* · *Refine ·  screen*), screen strip, **Flow** tab | Each full run reserves a screen slot. The new **Deliver** stage saves it, links the previous screen's primary action to it, and analyses its code. Preview clicks follow the links (prototype mode). |
| **Import data from a database** | Header **DB chip** → Data sources drawer | The agent runs `db.introspect` in Sense and `db.query` in Mind, then maps rows onto components. The drawer can add connections (Postgres/MySQL/SQL Server/Mongo/REST), browse tables, preview rows and **bind a table to any table/list/chart/select** (deterministic recompile, no LLM). |
| **Export ZIP for a tech stack** | Canvas **Export** | You must choose a stack first: **Angular 21 (AAVA Play)**, **React 19 + Vite**, **Vue 3 + Vite** or **Static HTML**. Then configure (screens, live-data API client, Playwright+axe tests, Docker, CI), review the **code analysis** and the file explorer, and download. |
| **Code analysis** | Deliver step, Export review, Publish preflight | Static scan: raw colours, off-scale spacing, `any`, `console.log`, missing alt/labels, non-catalog components, hard-gate and sign-off status, orphan screens, dependencies and LOC. |
| **Publish to cloud** | Canvas **Publish** | Pick a stack → provider (Vercel, Netlify, AWS, Azure, GCP), region and environment → **preflight gates** (production needs all of them green) → streamed deploy log and URL. |

Verified end to end: exported **Angular, React, Vue and static HTML** projects all run `npm install` and `npm run build` cleanly (Angular under `strictTemplates`, React/Vue under `tsc -b`/`vue-tsc -b`) and navigate the flow in Chrome.

### Exported projects run locally

```bash
unzip my-app-angular.zip && cd my-app && npm install && npm start
```

- Each ZIP contains one top-level project folder, plus `.nvmrc` (Node 22) and `engines` (Node ≥ 20.19).
- **Angular** defaults to a **portable AAVA Play kit** (`src/app/aava-play`). It has the same selectors and inputs as `@aava/play` and is mapped via tsconfig `paths`, so it installs from public npm. Choose *Internal @aava/play package* in Configure only if you can reach the private registry.
- **Static HTML** also ships a `package.json` (`npm start` → `serve`).

### Deployment configuration (Publish → Provider & config)

| Provider | Settings | Generated files |
| --- | --- | --- |
| Vercel | team/scope, project, region, Node version, token | `vercel.json` (framework preset, build/output, SPA rewrite, cache headers) |
| Netlify | site, team, Node version, token | `netlify.toml` (build, env, redirects, headers) |
| AWS | S3+CloudFront or Amplify, region, bucket, distribution, OIDC role ARN | `.github/workflows/deploy-aws.yml` + SPA error responses, or `amplify.yml` + redirects |
| Azure | subscription, resource group, app, region, plan, deployment token | `staticwebapp.config.json` + SWA GitHub workflow |
| Google Cloud | project, region, service, memory, min/max instances, auth, service account | `deploy/Dockerfile.cloudrun`, nginx (port 8080), `cloudbuild.yaml` |

- Every provider also gets the data API URL plus custom environment variables, a live preview of the files, and the equivalent **CLI commands**.
- Export can bundle any provider's config, together with a `DEPLOY.md`.
- Tokens are never persisted or written into files.

### Reordering the flow

Flow tab → **Reorder**:

1. Drag a screen onto another to **swap** them, or use **← / →**, or **Swap with…** (works on touch).
2. Cards glide to their new slots, and moved screens show *was n → m*.
3. **Confirm order** applies the new order to the screen strip, export routes and default route. With *Re-link primary navigation* on, each screen's main action is re-chained to open the next screen.

Try these prompts:

| Prompt | What it shows |
| --- | --- |
| `Login screen from Figma, AAVA theme, SSO option` (attach the demo Figma link) | Figma ingest, plan approval (HITL ①), auto-fix loop (0.83 → 0.94) |
| `Revenue analytics dashboard with KPIs, weekly chart and recent orders` | Data components, responsive KPI grid, auto-fix of a11y and spacing gaps |
| `Profile settings form with notification preferences` | A blocked non-catalog component, score below 0.75 → **escalation (HITL ③)** |
| After a run: `Change the heading to "Welcome back"`, `Make all buttons full width`, `Remove the SSO button` | **Refine mode**: JSON patch on the A2UI tree, cached context, re-verify only what changed |
| `Add an orders list screen`, `Add a product catalog screen`, `Add a team members screen`, `Add a notifications inbox`, `Add a checkout screen`, `Add a sign-up screen`, `Add a forgot-password screen` | New screens in the same flow, with data imported from the demo DB |
| `Add a contact us page with name, email and message` | Generic screen built from free text (fields detected from the prompt) |

## What's in the workspace

- **Header**: run status, source, quality score, lint count, dark-mode toggle, history, theme settings.
- **Step map**: the live 7-stage pipeline with nested tool calls, durations and iteration counts. Skipped steps are shown as skipped.
- **Chat**: streamed agent narration (from AG-UI `TEXT_MESSAGE_*` events), prompt suggestions, and an optional Figma link and token. The token is never echoed back.
- **HITL card**: approve, edit or reject at ① plan, ② final sign-off and ③ escalation. On phones it becomes a bottom sheet.
- **Canvas** has five tabs:
  - **Preview**: the A2UI surface rendered by the AAVA Play catalog. It has a device toggle (desktop, tablet, mobile; container queries make it reflow like a real viewport), a live data model, and actions that go back to the agent. Unknown components are **blocked**.
  - **Spec**: the generated markdown spec plus the audit report. Copy it or download the `.md`.
  - **Code**: Monaco multi-file editor with edit-back, a **diff against the previous version**, copy, and **ZIP download**.
  - **Quality**: score ring, weighted breakdown, hard gates, gap report, threshold bands, precedence rules.
  - **Events**: the raw AG-UI event stream with category filters and expandable JSON payloads.
- **Theme & settings**: 7 presets, light/dark/system mode, custom primary, accent and ink colours (with a live contrast ratio), corner radius, density, font, text size and reduced motion. Also run behaviour: auto-approve the plan, and simulation speed. Everything is saved in `localStorage`.
- **Run history**: sample past runs with pilot KPIs and a re-run button.

## Architecture

```
src/
├─ app/                     # Composition root
│  ├─ App.tsx               # Provider tree
│  ├─ Workspace.tsx         # Responsive two-pane layout + mobile bottom nav
│  └─ providers/            # ThemeProvider · RunProvider · ToastProvider
├─ config/                  # App constants, step meta, weights, thresholds, theme presets
├─ types/                   # agui.ts (events) · a2ui.ts (messages) · run.ts · scenario.ts · theme.ts
├─ data/                    # Dummy data: 3 scenarios + run history
├─ services/
│  ├─ agent/                # AgentClient interface
│  │  ├─ mock/              #   MockAgentClient + scripted flows + refinement fixer
│  │  └─ HttpAgentClient.ts #   Real AG-UI over SSE (POST + /resume)
│  ├─ codegen/              # Deterministic A2UI → Angular mapper + spec generator
│  ├─ datasource/           # Data-source clients (mock DB | HTTP BFF) + row→component binding
│  ├─ analysis/             # Static code analysis (Deliver, Export, Publish preflight)
│  ├─ publish/              # Cloud publish clients (simulated | HTTP deploy BFF)
│  ├─ quality/              # Weighted scoring + gate decision
│  └─ export/               # Stack templates: ir.ts (A2UI→IR) · render.ts (JSX/Vue/HTML) · stacks.ts · css.ts
├─ state/                   # runReducer (AG-UI events → UI state) · a2uiProcessor
├─ hooks/                   # useMediaQuery, useLocalStorage, useAutoScroll, …
├─ components/ui/           # Design-system primitives (Button, Badge, Tabs, Drawer, …)
├─ features/                # header · chat · steps · hitl · canvas/* (incl. flow) · screens · data · export · publish · settings · history
└─ styles/
   ├─ abstracts/            # breakpoints, mixins, functions (injected into every SCSS file)
   └─ base/                 # tokens (CSS variables), reset, typography, utilities
```

### Data flow

```
PromptComposer ──start()──► RunProvider ──run()──► AgentClient (mock | http)
                                 ▲                         │  AG-UI events
                                 └──── dispatch(event) ◄───┘
                          runReducer ─► steps · chat · interrupt · surface (A2UI) · shared state (files/spec/quality)
                                 │
            StepMap · ChatThread · HitlCard · CanvasPanel (Preview/Spec/Code/Quality/Events)
```

- **One contract.** The UI depends only on `AgentClient`. The mock emits exactly the events a real backend would: `RUN_*`, `STEP_*`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_SNAPSHOT/DELTA`, plus `CUSTOM` events for `a2ui`, `interrupt` and `step_skipped`.
- **Pure reducer.** All UI state comes from that event stream. JSON Patch deltas keep the files, spec and score in sync.
- **The LLM decides, deterministic code does the work.** Code and spec are compiled from the A2UI tree by `services/codegen`, not generated token by token.
- **Safe rendering.** The preview resolves every node against `AAVA_PLAY_CATALOG`. Anything else is blocked and flagged.

### Theming

All component SCSS reads CSS custom properties only. `ThemeProvider` writes `--c-primary`, `--c-accent`, `--c-ink`, `--radius-base`, `--space-unit`, `--font-scale` and `--font-sans` on `<html>`. Hover, soft and border variants are **derived with `color-mix()`**, so one colour pick re-themes the whole app, including the generated preview. Text colour on the primary background is chosen automatically by WCAG contrast.

### Responsive design

- **≥ 1280px**: wide two-pane layout (460px left pane).
- **768–1023px**: narrower left pane; tabs and toolbars condense.
- **< 768px (phones)**: one view at a time (Chat · Steps · Canvas) with a bottom tab bar and a dot on a tab when something changed there. HITL appears as a bottom sheet, drawers become bottom sheets, the code file tree becomes a picker, and Monaco wraps lines. Inputs use 16px text so iOS doesn't zoom, and safe-area insets are respected.
- The preview uses **container queries**, so the device toggle reflows the generated screen exactly like a real device would.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_AGENT_URL` | mock agent | AG-UI endpoint (SSE) for the AAVA Process Flow |
| `VITE_DATA_API_URL` | in-browser demo DB | Data BFF: `POST /sources/test`, `GET /sources/:id/tables`, `GET /sources/:id/tables/:name?limit=` |
| `VITE_PUBLISH_URL` | simulated provider pipeline | Deploy BFF: `POST /deployments` (multipart `artifact` ZIP + `meta`) → `{ id, url }` |

With the defaults, publishing **packages the real ZIP** but **simulates** the provider pipeline. The UI labels these deployments as simulated, and their URLs are not live.

## Connecting a real AAVA backend

```bash
echo "VITE_AGENT_URL=https://your-bff.example.com/api/aava/prompt-to-ui" > .env.local
npm run dev
```

The BFF must:
1. Accept `POST {url}` with a `RunAgentInput` body and stream AG-UI events as SSE.
2. Accept `POST {url}/resume` with `{ interruptId, decision, note }` to resume a run paused for HITL.

The Figma token arrives in `forwardedProps.figma`. The BFF must move it into the vault and strip it before anything reaches the LLM.
