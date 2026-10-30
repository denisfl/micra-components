# Cropper.js — image cropping integration

A thin reactive wrapper around [Cropper.js v2](https://fengyuanchen.github.io/cropperjs/)
(Chen Fengyuan's MIT image cropper). Cropper v2 is a set of web components
(`<cropper-canvas>`, `<cropper-image>`, `<cropper-selection>`, …) that own the
cropping — drag, resize, pan, zoom, handles. Micra mirrors the selection geometry
into state, so a live `x / y / width / height` readout reacts as you drag, a
"Crop" button turns the current selection into a PNG preview, and an aspect-ratio
toggle constrains the box — all with no extra code. A token skin makes Cropper
match your theme (including dark mode).

Open `index.html` to see it running (light + dark).

We sell the **glue** — reactive binding, the token skin, clean teardown — not a fork
of Cropper. Cropper loads from a CDN and stays Cropper.

## Use it

1. Load the tokens and this skin, then Cropper (as an ES module — it registers the
   custom elements), Micra, and the wrapper. **Order note:** Cropper ships as an ES
   module, and `type="module"` scripts are deferred, so Cropper may finish loading
   *after* `Micra.start()`. The wrapper handles that race — it attaches its listener
   regardless and seeds state once Cropper upgrades the element — so the script order
   below is safe.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="cropper.css" />

   <script type="module">
     import 'https://cdn.jsdelivr.net/npm/cropperjs@2/dist/cropper.esm.js';
   </script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup — Cropper's element tree and any UI bound to the wrapper's
   reactive state. The image source can be any `src` (a URL, or — as in the demo —
   a self-contained `data:` URI):

   ```html
   <micra-cropper>
     <cropper-canvas background style="height: 22rem">
       <cropper-image src="…" rotatable scalable translatable></cropper-image>
       <cropper-shade hidden></cropper-shade>
       <cropper-handle action="select" plain></cropper-handle>
       <cropper-selection initial-coverage="0.5" movable resizable outlined>
         <cropper-grid role="grid" covered></cropper-grid>
         <cropper-crosshair centered></cropper-crosshair>
         <cropper-handle action="move" theme-color=""></cropper-handle>
         <cropper-handle action="n-resize" theme-color=""></cropper-handle>
         <!-- …e/s/w + the four corner resize handles, each theme-color="" … -->
       </cropper-selection>
     </cropper-canvas>

     <span data-text="readout()"></span>
     <button @click="setRatio('1')">1:1</button>
     <button @click="crop">Crop</button>
     <img data-show="hasOutput()" data-bind="src:output" alt="Cropped result" />
   </micra-cropper>
   ```

3. Call `Micra.start()` once, after the scripts above.

> **Why `theme-color=""` on the handles?** Cropper colors the selection outline,
> handles, grid, and crosshair from an inherited `--theme-color` CSS variable. The
> skin sets that to `--micra-primary` on `<cropper-canvas>`. Each handle, however,
> ships a default color that would otherwise win, so we clear it with an empty
> `theme-color` and let the token cascade in.

## What you get

The wrapper exposes:

- `state.crop` — the live selection geometry `{ x, y, width, height }` (rounded to
  whole pixels), replaced on every Cropper `change` event. Bind it through
  `readout()` for a live "W × H at (x, y)" string.
- `state.output` — the cropped PNG as a `data:` URL, set by `crop()`. Bind
  `data-bind="src:output"` for a live preview; `hasOutput()` drives the empty state.
- `crop()` — turns the current selection into a canvas via Cropper's
  `cropper-selection.$toCanvas()` (returns `Promise<HTMLCanvasElement>`), reads it
  back as a PNG data URL into `state.output`.
- `setRatio(value)` / `isRatio(value)` — toggle the selection's aspect ratio
  (`'free' | '1' | '16:9' | '4:3'`); sets the element's `aspectRatio` property
  (`NaN` = free) and re-renders so the box conforms immediately.

The Cropper v2 API used: `<cropper-selection>`'s `change` event (geometry on
`event.detail`), the `aspectRatio` property, `initial-coverage` / `outlined`
attributes, and `$toCanvas()`.

## Theming

- The skin references only `--micra-*` tokens, so it follows your theme. Recolor by
  overriding tokens — no edits here:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

- **Dark mode** works: the canvas surround uses tokens and the selection/handles
  follow `--micra-primary` through Cropper's `--theme-color` variable; the shade
  (dimmed area) maps to `--micra-overlay`, which darkens in dark mode. Set
  `data-theme="dark"` on `<html>`.
- **Full control** — `cropper.css` is yours; edit it.

## Server fit

`$toCanvas()` gives you an `HTMLCanvasElement`, so instead of a preview you can post
the crop: `canvas.toBlob(blob => upload(blob))`, or read `canvas.toDataURL()` as the
wrapper does. The geometry in `state.crop` is also enough to crop server-side. No
build step. The wrapper cleans up after itself (`onCreate` wires Cropper's `change`
event, `onDestroy` removes it), so it's safe under `Micra.autoCleanup()` when htmx or
Astro swaps the island out. Cropper's elements clean up their own internals.

## Accessibility

Give `<cropper-canvas>` an `aria-label` describing the image. The handles are
keyboard- and pointer-driven by Cropper; the surrounding Micra controls are real
`<button>`s with a token focus ring.

## License

Cropper.js v2 is **MIT** (Chen Fengyuan). This wrapper and skin are MIT too — see `LICENSE` in the repo root.
