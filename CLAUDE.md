# CLAUDE.md — Micra components

Guidance for this repository. Self-contained: do not assume the core
`micra.js` CLAUDE.md is loaded, though the same Micra coding rules apply (restated
below). Merge with any project-specific instructions.

## What this repo is

Ready-made components, templates, library integrations and an AI kit for
[Micra.js](https://micrajs.dev). MIT, public. Everything here is **plain HTML + JS +
CSS, no build step**. Micra comes from the CDN/npm and is never vendored; this repo
never changes the core (`../micra.js`).

## The model (read this first)

Each component has two parts:

1. **Headless behavior** (`define.js`) — the Micra component: focus management,
   keyboard, ARIA, edge cases, data logic.
2. **Default skin** (`<name>.css`) — styling that consumes CSS custom properties
   from `theme/theme.css`. Users re-skin by overriding tokens or rewrite the CSS.

**The skin is plain CSS driven by `--micra-*` variables**, so it works with any stack.
Tailwind is supported and optional: components set `data-state` and `aria-*` via
`data-bind`, which both the default CSS and Tailwind's variants can target.
`theme.tailwind.css` maps the tokens into Tailwind v4 `@theme`.

## Repo layout

```
theme/
  theme.css            Design tokens (--micra-*), light + dark. The skin contract.
  theme.tailwind.css   Optional: maps tokens into Tailwind v4 @theme (bonus).
components/
  <name>/
    index.html         Self-contained runnable demo (links theme.css + skin + CDN).
    define.js          Headless behavior — the Micra component definition.
    <name>.css         Default skin — consumes --micra-* tokens only.
    README.md          Paste-in guide (how to use, theming, a11y, license).
templates/             Finished screens assembled from the components.
library-integrations/  Thin Micra wrappers around third-party libs (Trix, Chart.js, ...).
prompts/               AI kit — llms-components.txt, rules.md, task-prompts.md.
```

## Theme token contract

Skins reference **only** `--micra-*` variables — never hardcode a color, radius,
shadow, or duration. Current tokens (see `theme/theme.css`): `--micra-bg`,
`--micra-surface`, `--micra-fg`, `--micra-muted`, `--micra-border`,
`--micra-primary`, `--micra-primary-fg`, `--micra-ring`, `--micra-success`,
`--micra-warning`, `--micra-error`, `--micra-overlay`, `--micra-radius`,
`--micra-shadow`, `--micra-duration`, `--micra-ease`.

Dark mode = the same tokens with different values, applied via
`[data-theme="dark"]` (explicit) and `@media (prefers-color-scheme: dark)` (auto,
unless `data-theme="light"` is set). `prefers-reduced-motion` zeroes
`--micra-duration`, so token-driven transitions stop without per-component code.

## Micra coding rules (apply to every `define.js` and demo)

- **Lists** go through `<template data-each="…" data-key="…">`, never
  `innerHTML`/`getElementById` loops.
- **Derived values are methods**, not state fields. State holds raw data only;
  counts/filters/labels are methods (`total() { return this.state.items.length }`).
- **Event handlers** via `@event` / `data-on` (`@click`, `@submit.prevent`,
  `@keydown.escape`, …) — never `addEventListener` inside a method. Global keys and
  outside-click go on the component root as modifiers (Micra 2.9+), which Micra
  removes on destroy: `@keydown.meta.k.window.prevent="toggle"`,
  `@pointerdown.outside="close"`. A listener that must be added from JS (a scroll
  follower, a third-party library's event, a drag) uses
  `this.listen(target, type, fn)` (Micra 2.14+), which destroy() also removes.
- **Overlays are native.** Modal, slide-over and command palette are a `<dialog>`
  opened with `showModal()` (inert page, Escape, focus in and back, top layer);
  dropdown and popover are `popover` + `popovertarget` (light dismiss, top layer)
  anchored with CSS anchor positioning and a JS fallback. State (`isOpen` / `open`)
  follows the element's `close` / `toggle` event. No focus trap, scroll-lock JS or
  double `requestAnimationFrame` in these components.
- **Wait for the render with `await this.tick()`** before focusing or scrolling to
  something a state write just changed.
- **No manual re-render** after a mutation. Writing a top-level `state` property
  schedules a batched render; methods recompute on read.
- **No nested-path writes** (`state.user.name = x`). Replace the top-level
  property (`state.user = { ...state.user, name: x }`) or use `this.set('user.name', x)`.
- **Clean up** every timer / document listener from `onCreate` in `onDestroy`.
- **CDN** is `cdn.jsdelivr.net/npm/micra.js@<version>/dist/micra.min.js` — never unpkg.
- `Micra.start()` runs once at the end of the demo.

### Instance API quick reference

`this.$el` (root element) · `this.state` (reactive; top-level writes re-render) ·
`this.refs.<name>` (from `data-ref="name"`) · `this.prop(name, default?)` (read a
`data-*` attr from the root; casts `"true"`/`"false"`→bool and numeric→number,
else string; absent→`default`. A **bare** attr like `data-x` is `""` — falsy, NOT
`true` — so for boolean flags use `data-x="true"` or `this.prop('x', false) !== false`) ·
`this.set(path, value)` (nested write sugar) · `this.fetch(url, opts)` (JSON, throws
on non-2xx) · `this.emit(event, payload)` / `this.on(event, cb)` (event bus,
auto-cleaned).

State styling convention: set `data-state` / `aria-*` via `data-bind`
(e.g. `data-bind="data-state:open ? 'open' : 'closed'"`) so any CSS can react.

## Honesty constraints

State what a component does and where its limits are. No fabricated benchmarks or
testimonials.

## Process

- **Denis makes all commits, pushes, and tags.** Never commit on his behalf.
- Shipped files and docs are in **English**; no emoji.
- Match the surrounding code style. Surgical changes — touch only what the task needs.
- Never delete in production (global rule); deletions are manual by Denis.

## Pointers

- Core source: `../micra.js` (read-only from here).
- Docs & live examples: https://micrajs.dev (content lives in `../micra.js-site`).
