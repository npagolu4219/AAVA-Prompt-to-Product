# 09 · UI, theming & SCSS

## Styling architecture

- **CSS Modules + Sass.** Each component has `Component.module.scss` next to it, and class names are scoped per module.
- **Shared abstracts are injected automatically.** `vite.config.ts` prepends `@use "abstracts" as *;` to every SCSS file (`loadPaths: src/styles`). Mixins and functions are therefore available without imports.
- **Global styles:** [`styles/main.scss`](../src/styles/main.scss) loads `base/` (tokens, reset, typography, utilities, view transitions).
- **Keyframes are module-scoped,** so define them inside the module that uses them.

### Abstracts ([`styles/abstracts`](../src/styles/abstracts))

| Kind | Name | Use |
|---|---|---|
| function | `sp($n)` | Spacing on the density-aware 4px scale (`calc(var(--space-unit) * n)`) |
| function | `rem($px)` | px → rem, scaled by the user's font scale |
| mixins | `up(md)`, `down(md)`, `between(sm, lg)`, `touch` | Breakpoints: sm 480 · md 768 · lg 1024 · xl 1280 (keep in sync with `BREAKPOINTS` in `config/app.ts`) |
| mixins | `focus-ring`, `focusable` | Accessible focus styling |
| mixins | `reset-button`, `flex-center`, `truncate`, `line-clamp`, `visually-hidden`, `mono`, `eyebrow`, `card`, `tint($color)`, `scrollbar-thin`, `transition(...)` | Common patterns |

## Theme tokens

`ThemeProvider` writes user settings to CSS custom properties on `<html>`. Component SCSS reads **only** these variables, so changing a setting re-themes the whole app instantly.

| Group | Tokens |
|---|---|
| Brand | `--c-primary`, `--c-accent`, `--c-ink`, `--c-on-primary`, `--c-on-accent` |
| Derived (via `color-mix`) | `--c-primary-hover/-soft/-softer/-border/-text`, `--c-accent-soft/-border/-text`, `--c-focus` |
| Surfaces & text | `--c-bg`, `--c-surface` (+ `-2`, `-3`), `--c-border(-strong)`, `--c-text(-muted/-subtle)`, `--c-overlay`, `--c-code-*`, `--c-header-*` |
| Status | `--c-success`, `--c-warning`, `--c-danger`, `--c-info` |
| Shape & density | `--radius-sm/md/lg/pill`, `--space-unit`, `--font-scale`, `--font-sans`, `--font-mono` |
| Motion & elevation | `--dur-fast`, `--dur`, `--dur-slow`, `--ease`, `--shadow-sm/md/lg` |

**User-configurable** (Theme & settings drawer, `ThemeSettings`):

- **Preset:** AAVA Teal (default), Indigo Night, Ocean, Forest, Sunset, Orchid, Graphite. Custom primary, accent and ink colours can also be set.
- **Mode:** light, dark or system. Dark mode uses `[data-theme='dark']`.
- **Density, corner radius, font scale and font family.**
- **Reduce motion:** sets `[data-motion='reduced']`, which zeroes durations and stops decorative animations. The OS `prefers-reduced-motion` setting is honoured too.

Exported projects receive the same theme as `tokens.css`, so the generated app matches what you saw.

## Responsive behaviour

| Width | Layout |
|---|---|
| ≥ 1280 | Nav expanded (268px). Studio: chat/steps column `clamp(300px, 32%, 440px)` + canvas |
| 1024–1279 | Nav collapsed to a 76px icon rail with tooltips |
| 768–1023 | Rail; Studio panes stack where needed; tables scroll horizontally |
| < 768 | Nav becomes an off-canvas drawer (menu button). Studio uses a bottom tab bar (Chat · Steps · Canvas). Code tab uses a file picker. Prompt bar buttons wrap and Generate goes full width |

Layouts are verified at 320, 390, 600, 768, 1024, 1280 and 1920px with no horizontal page scroll. Touch targets are at least 44px on touch devices.

## Motion inventory

| Where | Effect |
|---|---|
| Route change | View Transitions: page cross-fade; the landing prompt bar morphs into the Studio composer (`aava-prompt`); the logo morphs (`aava-logo`) |
| Left nav | Sliding active pill (spring); labels fade and slide in; edge collapse handle; tooltips on the collapsed rail; badge pop; live run card with progress ring; staggered drawer items on phones |
| Landing | Typewriter placeholder; rotating gradient border; Refine wand (wiggle, sparkles, scan shimmer, typewriter brief, completion burst, chips pop in) |
| Preview build theatre | Planning blueprint with scanning beam → components assemble node by node → live code panel |
| Step map / chat | Streaming text, tool rows, step status transitions |
| Code tab | Sliding scope toggle, screen groups fade in |

## Component primitives

[`components/ui`](../src/components/ui): Button / IconButton, Badge, Tabs, SegmentedControl, Switch, Modal, Drawer, EmptyState, ScoreRing, Markdown, and an Icon set of about 90 inline SVG icons (stroke-based, `currentColor`). Add a new icon to the `ICONS` map in [`Icon.tsx`](../src/components/ui/Icon.tsx) as path `d` strings, optionally with `circles` or `rects`.
