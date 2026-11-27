# 01 · Overview

## The problem

Building a new product screen normally passes through design, then development, then QA, often taking several days per screen. Generic "AI writes the code" tools are fast, but their output drifts from the design system, fails accessibility checks and is hard to review.

## The approach

AAVA Prompt-to-Product splits the work in two:

1. **Agents decide _what_ to build.** They read the intent, pick components from the approved **AAVA Play** catalog, plan the layout and emit a declarative UI tree (**A2UI**).
2. **Deterministic code decides _how_ it is written.** A mapper compiles the A2UI tree into framework code. No LLM tokens are spent on boilerplate, and the same tree always produces the same code.

Every screen is then **verified** (design lint, accessibility, visual checks and a critic), **auto-fixed** with small JSON patches rather than regeneration, and **signed off by a human** before it joins the product flow.

## Key concepts

| Concept | Meaning |
|---|---|
| **Run** | One pass of the agent pipeline. A *full run* builds a new screen; a *refine run* patches the active screen. |
| **Step** | One of the 8 pipeline stages: Sense, Match, Mind, Think, Act, Verify, Refine, Deliver. |
| **Agent** | A specialised worker inside a step, such as *Layout Planner* or *Critic*. Each has a model tier, which may be "deterministic". |
| **HITL checkpoint** | A pause for a human decision: ① plan approval, ② final sign-off, ③ escalation when quality is too low. |
| **AG-UI** | The event protocol between the agent backend and the UI: run, step, text, tool, state and custom events. |
| **A2UI** | A declarative UI format: a flat list of components with ids, props and children, plus a data model. Version v0.9. |
| **AAVA Play catalog** | The only components the agents may use (19 in this build). Unknown components are blocked and never rendered. |
| **Surface** | A rendered A2UI tree (components + data model) for one screen. |
| **Scenario** | A built-in screen pattern (sign-in, dashboard, orders…) with its plan, states, data needs and quality profile. Free-form prompts get a *generic* scenario. |
| **Screen / Project / Flow** | A conversation builds up to **10 screens**. Screens are ordered and linked by actions (e.g. *Sign in → Dashboard*), which makes the flow. |
| **Quality gate** | A weighted score (0–1) plus hard gates. The score decides whether the screen is delivered, auto-fixed or escalated. |
| **Context resource** | An org codebase, Figma library, design-system docs, OpenAPI spec, knowledge doc or upload that grounds the agents. |
| **Data source** | A connected database whose tables can be bound to components (tables, charts, lists, KPIs). |
| **Ledger** | One row per run with tokens, cost, human time and quality. It feeds the ROI dashboard. |

## What a user can do

- Describe a screen on the **landing page** and optionally **Refine** the prompt into a detailed brief first.
- Watch it **build live** in the Studio: the step map, chat, tool calls, a blueprint wireframe and then the assembled UI with its code.
- Approve or edit the **plan**, then **sign off** the result.
- **Refine** a screen in plain language ("make all buttons full width").
- Add more screens (up to 10), **reorder and link** them in the Flow tab, and click through the prototype.
- Inspect the **Spec**, **Code** (all screens + app shell), **Quality** report and raw **Events**.
- **Bind database tables** to components.
- **Export** a runnable project (Angular, React, Vue or static HTML) with deploy configs, or **Publish** it to a cloud provider.
- Add **context resources**, browse **chat history**, and track **ROI**: hours saved, AI cost and value against a manual baseline.

## Pages

| Route | Page | Purpose |
|---|---|---|
| `#/` | Landing | Prompt bar with Refine, Figma link, database and context chips, quick starts |
| `#/studio` | Studio | Chat + step map (left) and canvas tabs (right) |
| `#/resources` | Context | Manage context resources |
| `#/history` | History | Saved conversations |
| `#/roi` | ROI | Business-value dashboard |

Drawers available from anywhere: **Data sources**, **Theme & settings**.
