# 11 · User guide

## 1. Start from the landing page

1. Type what you want, e.g. *"A revenue dashboard with KPIs and recent orders"*.
2. *(Optional)* Click **Refine** (the wand) or press **⌘/Ctrl+I** to turn your idea into a detailed brief. Choose one of:
   - **Enhance:** layout, components, states, responsive rules and data.
   - **Make concise.**
   - **Accessibility:** WCAG requirements.
   - **Bind to data:** the tables to use.

   Use **Undo** to go back to your original text.
3. *(Optional)* Attach a **Figma** frame (link + token), check the **database** chip (the connected source) and the **context** chip (the resources the agents will use).
4. Press **Enter** or **Generate**. The Studio opens and the build starts.

## 2. Watch it build (Studio)

- **Left:** the **step map** (Sense → Deliver, with tool calls and timings) and the **chat**, where agents explain what they're doing.
- **Right:** the **canvas**. Preview shows a blueprint while planning, then the screen assembling piece by piece, with live code.

## 3. Make decisions (human-in-the-loop)

| Card | Your options |
|---|---|
| **① Approve layout plan** | Approve · Edit (add a note, e.g. "put filters on the left") · Reject (an alternative plan is offered once) |
| **③ Needs your decision** (low quality score) | Apply fixes · Fix with guidance · Keep as is |
| **② Sign off** | Sign off (adds the screen to the flow) · Not yet (keep as a draft) |

To skip plan approval for trusted templates, turn on *Auto-approve plan* in **Theme & settings**.

## 4. Refine a screen

With a screen selected, type a change in the composer:

- *Change the heading to "Welcome back"*
- *Make all buttons full width*
- *Make the main button secondary*
- *Remove the SSO button*

Only the affected components are patched and re-verified. Check **Code → Diff**.

## 5. Build a multi-screen flow

- Type a new screen in the composer (*"Add an orders list screen"*) or click **+ Screen**. A project holds up to **10 screens**.
- Each new screen is linked from the previous screen's main action automatically.
- **Flow tab:** reorder screens, **Confirm order** (optionally re-link them in sequence), and change which action goes where.
- In **Preview**, click buttons to move through the flow like a prototype.

## 6. Inspect the result

| Tab | What you get |
|---|---|
| Preview | Interactive screen; switch desktop, tablet or phone; bind database tables |
| Flow | Screen order and links |
| Spec | Markdown spec: intent, plan, components, data, states, quality, changelog |
| Code | **All screens** (app shell + every screen) or **This screen**. Edit, diff, copy, ZIP |
| Quality | Score, five dimensions, hard gates, gaps, iteration history |
| Events | Raw AG-UI event log (for engineers) |

## 7. Use your data and context

- **Data sources** (nav → Data sources): connect PostgreSQL, MySQL, SQL Server, MongoDB or REST. The demo database is ready to use. Agents import the rows a screen needs, and you can bind more tables in Preview.
- **Context** (nav → Context): add your org codebase, Figma library, design-system docs, OpenAPI specs, knowledge docs or files. Enabled sources ground every run. Type `@handle` in the composer to include a specific one.

## 8. Export or publish

- **Export:** choose a stack (Angular, React, Vue, HTML) → options (screens, tests, data, Docker, CI, deploy target) → review the analysis → download the ZIP. Then run `npm install && npm start` (Angular, HTML) or `npm run dev` (React, Vue).
- **Publish:** choose Vercel, Netlify, AWS, Azure or Google Cloud → environment, region, settings → deploy. You get the live URL.

## 9. History and ROI

- **History:** every conversation is saved automatically in this browser. You can search, reopen, rename or delete them.
- **ROI:** hours saved, AI cost, net value and ROI by period and project, against an editable manual baseline (**Assumptions**). Export the project table as CSV.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Enter / Shift+Enter | Send / new line |
| ⌘/Ctrl+I | Refine prompt (landing) |
| 1–4 (in the Refine menu) | Pick a mode |
| ⌘/Ctrl+B | Collapse or expand the left nav |
| Esc | Close menus, drawers and dialogs; cancel a refine |
