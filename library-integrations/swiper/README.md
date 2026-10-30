# Swiper — carousel / slider integration

A thin reactive wrapper around [Swiper](https://swiperjs.com) (the MIT
`<swiper-container>` web component). Swiper owns the carousel — touch, momentum,
navigation, pagination, keyboard; Micra mirrors its active index into state, so a
"Slide X of N" readout and a custom dot strip both react with no extra code — and
the dot strip drives Swiper back, so the binding is two-way. A token skin makes
Swiper's arrows, bullets, and slides match your theme (light and dark).

Open `index.html` to see it running (light + dark).

We sell the **glue** — reactive binding, the token skin, clean teardown — not a fork
of Swiper. Swiper loads from a CDN and stays Swiper.

## Use it

1. Load the tokens and this skin, then Swiper Element's bundle, Micra, and the
   wrapper. **Order matters:** Swiper's bundle must run before `Micra.start()` so the
   `<swiper-container>` element is registered (and initialized) when the wrapper
   wires it. The bundle registers the custom elements and injects Swiper's own
   styles — there's no separate Swiper stylesheet to link.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="swiper.css" />

   <script src="https://cdn.jsdelivr.net/npm/swiper@12/swiper-element-bundle.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup — the carousel (Swiper config is attributes on
   `<swiper-container>`), then any UI bound to the wrapper's reactive state:

   ```html
   <micra-swiper>
     <swiper-container navigation="true" pagination="true" loop="true" keyboard="true">
       <swiper-slide>…</swiper-slide>
       <swiper-slide>…</swiper-slide>
     </swiper-container>

     <span data-text="position()"></span>            <!-- "Slide 2 of 6" -->
     <button @click="prev">Prev</button>
     <button @click="next">Next</button>

     <ul class="swiper-dots">                          <!-- custom dot strip -->
       <template data-each="dots()" data-key="key">
         <li>
           <button
             class="swiper-dots__dot"
             @click="goTo(item.i)"
             data-text="item.label"
             data-bind="data-active:item.active ? 'true' : 'false'"
           ></button>
         </li>
       </template>
     </ul>
   </micra-swiper>
   ```

3. Call `Micra.start()` once, after the scripts above.

## What you get

The wrapper exposes:

- `state.index` — the active slide (Swiper's `realIndex`, so it's loop-safe),
  updated on every slide change.
- `state.count` — total real slides, read once the element is ready.
- `position()` — the "Slide X of N" readout, derived.
- `dots()` — one entry per real slide for the custom dot strip (`<template data-each>`),
  each carrying `i`, `label`, `active`, and a `key`.
- `prev()` / `next()` — call Swiper's `slidePrev()` / `slideNext()`.
- `goTo(i)` — jump to a slide from the dot strip. Uses `slideToLoop(i)` under loop,
  `slideTo(i)` otherwise.

## Theming

- The skin maps `--micra-*` tokens onto Swiper's own CSS custom properties so the
  built-in arrows and bullets follow your theme:

  ```css
  swiper-container {
    --swiper-theme-color: var(--micra-primary);
    --swiper-navigation-color: var(--micra-primary);
    --swiper-pagination-color: var(--micra-primary);
    --swiper-pagination-bullet-inactive-color: var(--micra-muted);
  }
  ```

  The custom dot strip and the slides are styled off the same tokens. Recolor by
  overriding tokens — no edits here:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

- **Dark mode** works: everything references tokens, so `data-theme="dark"` on
  `<html>` re-skins the whole carousel — arrows, bullets, slides, and dot strip.
- **Full control** — `swiper.css` is yours; edit it.

## Reactivity notes

- Swiper Element **upgrades and initializes on connect**, which is before
  `Micra.start()`. The wrapper handles both orders: in `onCreate` it reads
  `el.swiper` inline if it already exists, and also wires the `swiperslidechange`
  event for ongoing changes (removed in `onDestroy`).
- With **loop** enabled, the readout and dots track `realIndex` (the original
  slide), not `activeIndex` (which counts Swiper's clone slides). Jumping uses
  `slideToLoop` so a dot maps to the right real slide.
- The wrapper cleans up after itself (`onCreate` wires Swiper's event, `onDestroy`
  removes it), so it's safe under `Micra.autoCleanup()` when htmx or Astro swaps
  the island out.

## Accessibility

Swiper renders its own navigation and pagination; give the container an
`aria-label`. The custom dots are real `<button>`s with `aria-current` on the
active one and a token focus ring. Keyboard navigation is Swiper's `keyboard="true"`.

## License

Swiper is **MIT**. This wrapper and skin are MIT too — see `LICENSE` in the repo root.
