# Accordion

Accessible disclosure group: native `<button>` headers (Enter/Space toggle for
free), arrow-key roving focus, single- or multiple-open modes, correct
`aria-expanded` / `aria-controls` / `role="region"` wiring. Headless behavior in
`define.js`; the look is a default skin in `accordion.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="accordion.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Items come from `state.items` in `define.js` (edit that
   array for your content). The list renders through one `<template>`:

   ```html
   <micra-accordion>
     <template data-each="items" data-key="id">
       <div class="micra-accordion__item"
            data-bind="data-state:isOpen(item.id) ? 'open' : 'closed'">
         <button class="micra-accordion__header"
                 data-bind="id:item.id + '-h',
                            aria-controls:item.id + '-p',
                            aria-expanded:isOpen(item.id) ? 'true' : 'false'"
                 @click="toggle(item.id)"
                 @keydown.down.prevent="focusAt(index + 1)"
                 @keydown.up.prevent="focusAt(index - 1)"
                 @keydown.home.prevent="focusAt(0)"
                 @keydown.end.prevent="focusAt(-1)">
           <span data-text="item.title"></span>
           <svg class="micra-accordion__icon" width="16" height="16"
                viewBox="0 0 16 16" aria-hidden="true">
             <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" />
           </svg>
         </button>
         <div class="micra-accordion__panel" role="region"
              data-bind="id:item.id + '-p', aria-labelledby:item.id + '-h'"
              data-show="isOpen(item.id)">
           <p data-text="item.body"></p>
         </div>
       </div>
     </template>
   </micra-accordion>
   ```

3. Call `Micra.start()` once, after your components are defined.

Multiple accordions on one page work out of the box — each
`<micra-accordion>` is an independent instance with its own state.

## Props

- **`data-multiple`** (default `false`) — when `true`, any number of items can be
  open at once and each header toggles independently. When `false` (default),
  opening an item closes the others; clicking an open header collapses it.

  ```html
  <micra-accordion data-multiple="true"> … </micra-accordion>
  ```

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `accordion.css`. It is yours.
- **Tailwind (optional)** — the state lives in `data-state` and `aria-expanded`,
  so you can skip `accordion.css` and style with native variants instead:
  `class="… data-[state=open]:bg-muted aria-expanded:font-bold"`.

## Accessibility

Each header is a native `<button>` with `aria-expanded` and `aria-controls`
pointing at its panel; the panel is `role="region"`, labelled by its header. Only
open panels are rendered. Enter and Space toggle (free, from the button); the
arrow keys roam focus across headers, Home/End jump to first/last. Motion
respects `prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
