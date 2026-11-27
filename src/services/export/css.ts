import { DENSITY_UNIT_PX, FONT_STACK, RADIUS_PX } from '@/config/themes'
import type { ThemeSettings } from '@/types/theme'
import { readableOn } from '@/utils/color'

/** Design tokens generated from the user's current theme settings — the only place raw values live. */
export function tokensCss(t: ThemeSettings): string {
  const u = DENSITY_UNIT_PX[t.density]
  const r = RADIUS_PX[t.radius]
  return `/* AAVA Design System tokens — generated from your workspace theme. Edit here, not in components. */
:root {
  --aava-primary: ${t.primary};
  --aava-on-primary: ${readableOn(t.primary)};
  --aava-accent: ${t.accent};
  --aava-ink: ${t.ink};
  --aava-on-ink: ${readableOn(t.ink)};
  --aava-primary-hover: color-mix(in srgb, var(--aava-primary) 86%, black);
  --aava-primary-soft: color-mix(in srgb, var(--aava-primary) 12%, var(--aava-surface));

  --aava-bg: #f2f5f8;
  --aava-surface: #ffffff;
  --aava-surface-2: #f6f8fa;
  --aava-border: #dce3ea;
  --aava-border-strong: #c4cfda;
  --aava-text: #13263a;
  --aava-text-muted: #56687a;
  --aava-text-subtle: #8394a5;
  --aava-success: #1f8f5f;
  --aava-warning: #b7791f;
  --aava-danger: #c53030;

  --aava-font: ${FONT_STACK[t.fontFamily]};
  --aava-h1: 1.75rem;
  --aava-h2: 1.375rem;
  --aava-h3: 1.0625rem;

  --aava-space-1: ${u}px;
  --aava-space-2: ${u * 2}px;
  --aava-space-3: ${u * 3}px;
  --aava-space-4: ${u * 4}px;
  --aava-space-6: ${u * 6}px;
  --aava-space-8: ${u * 8}px;

  --aava-radius-sm: ${Math.round(r * 0.6)}px;
  --aava-radius-md: ${r}px;
  --aava-radius-lg: ${Math.round(r * 1.4)}px;
  --aava-shadow-sm: 0 1px 2px rgb(15 42 68 / 0.06), 0 1px 1px rgb(15 42 68 / 0.04);
}

@media (prefers-color-scheme: dark) {
  :root {
    --aava-bg: #0a141e;
    --aava-surface: #0f1d2b;
    --aava-surface-2: #132435;
    --aava-border: #223649;
    --aava-border-strong: #2f475e;
    --aava-text: #e5edf4;
    --aava-text-muted: #9badbe;
    --aava-text-subtle: #6f8396;
  }
}
`
}

/** Portable AAVA Play styles for stacks without the internal @aava/play package. Tokens only. */
export const AAVA_PLAY_CSS = `/* AAVA Play — portable component styles. Uses tokens.css; no raw colours below. */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: var(--aava-font); color: var(--aava-text); background: var(--aava-bg); line-height: 1.5; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.stack { display: flex; flex-direction: column; gap: var(--aava-space-4); min-width: 0; }
.stack--xs { gap: var(--aava-space-1); }
.stack--sm { gap: var(--aava-space-2); }
.stack--lg { gap: var(--aava-space-6); }
.stack--center { margin-inline: auto; width: 100%; }
.cluster { display: flex; flex-wrap: wrap; align-items: center; gap: var(--aava-space-3); }
.cluster--between { justify-content: space-between; }
.cluster--end { justify-content: flex-end; }
.cluster > .stack { flex: 1 1 160px; }
.cluster > .aava-field, .cluster > aava-text-field { flex: 1 1 220px; max-width: 420px; }
.grid { display: grid; gap: var(--aava-space-4); }
.grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.aava-card { display: flex; flex-direction: column; gap: var(--aava-space-4); padding: var(--aava-space-6); background: var(--aava-surface); border: 1px solid var(--aava-border); border-radius: var(--aava-radius-lg); box-shadow: var(--aava-shadow-sm); min-width: 0; }
.aava-card__title { margin: 0; font-size: 0.95rem; }
.aava-card__sub { margin: 0; font-size: 0.8rem; color: var(--aava-text-muted); }
.aava-card__body { display: flex; flex-direction: column; gap: var(--aava-space-4); min-width: 0; }

.aava-heading { margin: 0; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }
.aava-h1 { font-size: var(--aava-h1); }
.aava-h2 { font-size: var(--aava-h2); }
.aava-h3 { font-size: var(--aava-h3); }
.aava-text { margin: 0; }
.aava-text--muted { color: var(--aava-text-muted); }
.aava-text--subtle { color: var(--aava-text-subtle); }
.aava-text--sm { font-size: 0.75rem; }
.aava-text--strong { font-weight: 650; }
.aava-text--center { text-align: center; }

.aava-badge { display: inline-flex; align-self: flex-start; align-items: center; padding: 0 var(--aava-space-2); height: 1.4rem; border-radius: 999px; font-size: 0.72rem; font-weight: 650; background: var(--aava-surface-2); color: var(--aava-text-muted); }
.aava-badge--brand, .aava-badge--primary { background: var(--aava-primary-soft); color: var(--aava-primary); }
.aava-badge--success { background: color-mix(in srgb, var(--aava-success) 14%, transparent); color: var(--aava-success); }
.aava-badge--warning { background: color-mix(in srgb, var(--aava-warning) 14%, transparent); color: var(--aava-warning); }
.aava-badge--danger { background: color-mix(in srgb, var(--aava-danger) 14%, transparent); color: var(--aava-danger); }

.aava-field { display: flex; flex-direction: column; gap: var(--aava-space-2); min-width: 0; }
.aava-label { font-size: 0.8rem; font-weight: 600; }
.aava-req { color: var(--aava-danger); }
.aava-input { width: 100%; height: 2.6rem; padding: 0 var(--aava-space-3); border-radius: var(--aava-radius-md); border: 1px solid var(--aava-border-strong); background: var(--aava-surface); color: inherit; font: inherit; }
.aava-input:focus { outline: none; border-color: var(--aava-primary); box-shadow: 0 0 0 3px var(--aava-primary-soft); }
.aava-select { cursor: pointer; }
.aava-check { display: inline-flex; align-items: center; gap: var(--aava-space-2); cursor: pointer; }
.aava-check input, .aava-toggle__input { accent-color: var(--aava-primary); width: 1.1rem; height: 1.1rem; }
.aava-toggle { display: flex; align-items: center; justify-content: space-between; gap: var(--aava-space-4); padding: var(--aava-space-3) 0; cursor: pointer; }
.aava-toggle + .aava-toggle { border-top: 1px solid var(--aava-border); }
.aava-toggle__text { display: flex; flex-direction: column; }
.aava-toggle__label { font-weight: 600; }
.aava-toggle__desc { font-size: 0.8rem; color: var(--aava-text-muted); }
.aava-toggle__track { display: none; }

.aava-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--aava-space-2); height: 2.6rem; padding: 0 var(--aava-space-6); border-radius: var(--aava-radius-md); border: 1px solid transparent; font: inherit; font-weight: 650; cursor: pointer; }
.aava-btn--primary { background: var(--aava-primary); color: var(--aava-on-primary); }
.aava-btn--primary:hover { background: var(--aava-primary-hover); }
.aava-btn--secondary { background: var(--aava-surface); border-color: var(--aava-border-strong); color: var(--aava-text); }
.aava-btn--ghost { background: transparent; color: var(--aava-primary); }
.aava-btn--block { width: 100%; }
.aava-btn:focus-visible, .aava-link:focus-visible, .aava-list__item:focus-visible { outline: 2px solid var(--aava-primary); outline-offset: 2px; }
.aava-link { background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: var(--aava-primary); cursor: pointer; text-align: left; }
.aava-divider { display: flex; align-items: center; gap: var(--aava-space-3); font-size: 0.75rem; color: var(--aava-text-subtle); }
.aava-divider::before, .aava-divider::after { content: ''; flex: 1; height: 1px; background: var(--aava-border); }
.aava-avatar { display: inline-flex; align-items: center; justify-content: center; width: 3.5rem; height: 3.5rem; border-radius: 50%; font-weight: 700; color: var(--aava-on-primary); background: linear-gradient(135deg, var(--aava-primary), var(--aava-accent)); }

.aava-stat { display: flex; flex-direction: column; gap: var(--aava-space-1); padding: var(--aava-space-4); background: var(--aava-surface); border: 1px solid var(--aava-border); border-radius: var(--aava-radius-lg); }
.aava-stat__label { font-size: 0.8rem; font-weight: 600; color: var(--aava-text-muted); }
.aava-stat__value { font-size: 1.6rem; font-weight: 700; }
.aava-stat__delta { font-size: 0.8rem; font-weight: 650; }
.aava-stat__delta--pos { color: var(--aava-success); }
.aava-stat__delta--neg { color: var(--aava-danger); }

.aava-chart { margin: 0; }
.aava-chart__bars { display: flex; align-items: flex-end; gap: var(--aava-space-2); height: 12rem; border-bottom: 1px solid var(--aava-border); }
.aava-chart__col { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: flex-end; gap: var(--aava-space-1); height: 100%; }
.aava-chart__bar { width: 100%; max-width: 2.25rem; border-radius: var(--aava-radius-sm) var(--aava-radius-sm) 0 0; background: var(--aava-primary); }
.aava-chart__value, .aava-chart__label { font-size: 0.7rem; color: var(--aava-text-muted); }

.aava-table-wrap { overflow-x: auto; }
.aava-table { width: 100%; min-width: 26rem; border-collapse: collapse; font-size: 0.82rem; }
.aava-table th { text-align: left; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--aava-text-subtle); padding: var(--aava-space-2); border-bottom: 1px solid var(--aava-border); }
.aava-table td { padding: var(--aava-space-3) var(--aava-space-2); border-bottom: 1px solid var(--aava-border); white-space: nowrap; }
.aava-table .is-end { text-align: right; }
.aava-table .is-clickable { cursor: pointer; }
.aava-table tbody tr:hover { background: var(--aava-surface-2); }

.aava-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.aava-list > li + li { border-top: 1px solid var(--aava-border); }
.aava-list--grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--aava-space-4); }
.aava-list--grid > li + li { border-top: 0; }
.aava-list__item { display: flex; align-items: center; gap: var(--aava-space-3); width: 100%; padding: var(--aava-space-3) var(--aava-space-1); background: none; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.aava-list--grid .aava-list__item { flex-direction: column; align-items: stretch; height: 100%; padding: var(--aava-space-4); border: 1px solid var(--aava-border); border-radius: var(--aava-radius-lg); background: var(--aava-surface); }
.aava-list__thumb { display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; border-radius: var(--aava-radius-md); background: var(--aava-primary-soft); color: var(--aava-primary); font-size: 1.75rem; font-weight: 700; }
.aava-list__body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.aava-list__title { display: flex; align-items: center; gap: var(--aava-space-2); font-weight: 650; }
.aava-list__sub { font-size: 0.8rem; color: var(--aava-text-muted); }
.aava-list__aside { display: flex; flex-direction: column; align-items: flex-end; gap: var(--aava-space-1); }
.aava-list__meta { font-size: 0.8rem; color: var(--aava-text-muted); white-space: nowrap; }
.aava-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--aava-primary); }
.aava-blocked { padding: var(--aava-space-3); border: 1px dashed var(--aava-danger); border-radius: var(--aava-radius-md); color: var(--aava-danger); }

@media (max-width: 1023.98px) {
  .grid--3, .grid--4, .aava-list--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 767.98px) {
  .grid, .aava-list--grid { grid-template-columns: minmax(0, 1fr) !important; }
  .aava-card { padding: var(--aava-space-4); }
  .cluster--end > .aava-btn { flex: 1; }
}
`

/** App shell: top navigation across all screens in the flow. */
export const SHELL_CSS = `/* App shell — navigation between the generated screens. */
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.app-nav { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: var(--aava-space-4); padding: var(--aava-space-3) var(--aava-space-6); background: var(--aava-ink); color: var(--aava-on-ink); overflow-x: auto; }
.app-nav__brand { font-weight: 700; white-space: nowrap; }
.app-nav__links { display: flex; gap: var(--aava-space-1); }
.app-nav__link { padding: var(--aava-space-2) var(--aava-space-3); border-radius: var(--aava-radius-md); color: inherit; opacity: 0.75; text-decoration: none; white-space: nowrap; font-size: 0.85rem; }
.app-nav__link:hover, .app-nav__link.is-active, .app-nav__link.router-link-active, .app-nav__link.active { opacity: 1; background: color-mix(in srgb, var(--aava-on-ink) 14%, transparent); }
.app-main { flex: 1; width: 100%; max-width: 75rem; margin: 0 auto; padding: var(--aava-space-8) var(--aava-space-6); }
@media (max-width: 767.98px) {
  .app-nav { padding: var(--aava-space-3) var(--aava-space-4); }
  .app-main { padding: var(--aava-space-6) var(--aava-space-4); }
}
`
