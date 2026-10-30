# Micra components — task prompts

Copy-paste prompts for common Micra work. Give your AI assistant `llms-components.txt` and
`rules.md` (and the core `llms-full.txt`) as context first, then use one of these.
Replace the `<…>` placeholders.

---

## Generate a component

> Build a Micra component for `<describe the behavior — e.g. a multi-select with
> search and keyboard nav>`. Follow the Micra rules: state holds raw data only,
> derived values are methods, lists use `<template data-each data-key>`, events use
> `@event`, ARIA state is bound as a `'true'`/`'false'` string. Style with `--micra-*`
> tokens only (no hardcoded colors), and make it work in dark mode. Give me
> `define.js`, the token CSS, and a runnable HTML demo that loads Micra from the `@2`
> CDN and calls `Micra.start()` once.

## Re-skin a component to my brand

> Re-skin the `<name>` component to match my brand: primary `<#hex>`, corner
> radius `<value>`, font `<family>`. Do it ONLY by overriding `--micra-*` tokens in a
> stylesheet loaded after the component's CSS — do not edit the component's CSS or
> hardcode values. Include a dark-mode token block under `[data-theme="dark"]`.

## Build a screen from components

> Assemble a `<describe — e.g. an admin users screen>` using the `<Data Table>`
> and `<Slide-over>` components. They must talk over the Micra event bus (`emit`/`on`),
> not by reaching into each other's state — a nested `[data-component]` is a scope
> boundary. Clicking a row opens the slide-over pre-filled; saving emits an event the
> shell applies (upsert by id). Seed the table from this data: `<paste/describe>`.

## Wrap a third-party library as a Micra integration

> Wrap `<library>` (loaded from its CDN) as a thin Micra component. Mount it in
> `onCreate`, mirror its `<relevant events>` into Micra `state`, and remove those
> listeners in `onDestroy`. If it's a web component, it may initialize before
> `Micra.start()` — handle the already-ready case inline. Add a token-driven skin over
> its CSS (works in light and dark) and a demo showing the reactive glue (e.g. a live
> preview / count bound to the mirrored state). Keep the wrapper thin.

## Convert hand-wired DOM code to Micra

> Convert this DOM code to Micra. Move the scattered state into `state`, replace the
> manual DOM updates with directives (`data-show`, `data-text`, `data-bind`,
> `data-class`, `<template data-each>`), and replace the event handlers with `@event`.
> Don't keep a `render()` function or manual `innerHTML`. Code: `<paste>`.

## Wire a component to my server data

> Seed the `<Data Table / Charts>` from my API instead of static data. Show me
> both: (1) the `data-*` / instance-seeding for the initial render, and (2) switching
> it to server mode where the component requests `<endpoint>` and I return
> `<shape>`. Use `Micra.instances().get(el)` to reach the live instance; replace
> top-level state, never mutate nested paths.

## Audit my Micra code

> Review this Micra code against the rules in `rules.md` and the gotchas in
> `llms-components.txt`. Flag: lists not using `data-each`/`data-key`, derived values kept in
> state, `addEventListener` in methods, nested-path state writes, hardcoded colors,
> ARIA bound as a bare boolean, `data-text` on an uncalled method, `data-model` on a
> checkbox for a controlled toggle. Code: `<paste>`.
