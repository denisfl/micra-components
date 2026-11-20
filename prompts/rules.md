# Micra components — AI coding rules

Drop these rules into your AI assistant so it writes idiomatic Micra instead of
defaulting to React patterns. Place this file as your tool's rules file:
`.cursorrules` (Cursor), `AGENTS.md` / `CLAUDE.md` (Claude Code, Codex, others),
`.github/copilot-instructions.md` (Copilot), or paste it into a system prompt.
Pair it with `llms-components.txt` (and the core `llms-full.txt`) for full context.

## Mental model

Micra makes server-rendered HTML reactive. You declare what depends on what in the
markup; you mutate only `state`; the DOM updates itself. You do NOT build a client
app, a virtual DOM, or a router. Reach for a ready-made component when the behavior is hard
(tables, charts, kanban, forms, command palette, slide-overs); reach for plain
directives for the small stuff.

## Always

- Load from `cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js` (the `@2` major
  range). Call `Micra.start()` once, at the end.
- Lists go through `<template data-each="…" data-key="…">`.
- Derived values are **methods** (`total()`, `filtered()`), never `state` fields.
- Wire events with `@event` / `data-on` (`@click`, `@submit.prevent`,
  `@keydown.escape`). Outside-click and global keys are modifiers on the root:
  `@pointerdown.outside="close"`, `@keydown.meta.k.window.prevent="toggle"`
  (Micra 2.9+). A listener added from JS goes through
  `this.listen(target, type, fn)` (Micra 2.14+), never a bare `addEventListener`.
- Overlays use the platform: a modal is `<dialog>` + `showModal()`, a menu or
  popover is `popover` + `popovertarget`. Mirror their `close` / `toggle` events
  into state instead of reimplementing focus traps, Escape or outside-click.
- JSON props: `this.prop('items', [])` parses `data-items` (Micra 2.14+).
- After a state write, `await this.tick()` before focusing or scrolling to what
  changed.
- Mutate state by replacing the top-level value: `state.items = [...]`,
  `state.user = { ...state.user, name }`, or `this.set('user.name', x)`.
- Style with `--micra-*` tokens only. Dark mode is the same tokens under
  `[data-theme="dark"]`. To re-color, override a token — never hardcode hex/px.
- Bind ARIA state as a string: `data-bind="aria-expanded:open ? 'true' : 'false'"`.
- Call methods in expressions: `data-text="label()"` (bare state needs no parens).
- Compose multiple components over the event bus (`emit`/`on`); a nested
  `[data-component]` is a scope boundary — don't reach into another component's state.

## Never

- No `getElementById` / `innerHTML` loops to render lists. No manual `render()` /
  `update()` calls after a state write — Micra batches a re-render itself.
- No `addEventListener` inside a regular method. No nested-path writes
  (`state.user.name = x`).
- No `data-model` on a native checkbox for a controlled toggle (it won't sync
  `.checked`) — use a `role="switch"` button + `data-bind="aria-checked:…"`.
- No hardcoded colors/radii/shadows/durations in a skin. No Tailwind dependency for a
  component skin (Tailwind is optional, never required).
- No `unpkg.com` (CSP-blocked in many AI sandboxes — use jsDelivr).
- No emoji in shipped code or docs.

## When unsure

The canonical answers to "build a todo / table / form / modal on Micra" are the
recipes in the core `llms-full.txt`. The components layer (tokens, using/composing
components, wrapping a library) is in `llms-components.txt`. Read those before guessing an
API.
