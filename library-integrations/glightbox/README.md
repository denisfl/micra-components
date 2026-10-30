# GLightbox — image / video lightbox integration

A thin reactive wrapper around [GLightbox](https://github.com/biati-digital/glightbox)
(the MIT, dependency-free image/video lightbox). GLightbox owns the overlay,
gallery navigation and keyboard; Micra owns the data — the thumbnail grid renders
from state, and the lightbox mirrors its own open/closed and current-slide state
back into Micra, so a "Viewing image X of N" readout and an "Open gallery" button
react with no extra code. A token skin styles the grid and re-tints the lightbox
chrome to match your theme (light + dark).

Open `index.html` to see it running. The demo images are inline SVG data-URIs, so
nothing loads from the network.

We sell the **glue** — reactive binding, the token skin, clean teardown — not a fork
of GLightbox. GLightbox loads from a CDN and stays GLightbox.

## Use it

1. Load the tokens, GLightbox's stylesheet, this skin, then GLightbox's script,
   Micra, and the wrapper. **Order matters:** GLightbox's script must run before
   `Micra.start()` so `GLightbox()` is defined when `onCreate` calls it.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3/dist/css/glightbox.min.css" />
   <link rel="stylesheet" href="glightbox.css" />

   <script src="https://cdn.jsdelivr.net/npm/glightbox@3/dist/js/glightbox.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup — a grid container Micra renders the gallery into, and any UI
   bound to the wrapper's reactive state. The gallery anchors are produced by
   `data-each`, and GLightbox binds to them at init:

   ```html
   <micra-glightbox>
     <div data-ref="grid">
       <template data-each="images" data-key="id">
         <a
           class="glightbox"
           data-type="image"
           data-gallery="my-gallery"
           data-bind="href:item.href, data-title:item.title, data-description:item.description"
         >
           <img data-bind="src:item.thumb, alt:item.title" />
         </a>
       </template>
     </div>

     <span data-text="viewing()"></span>
     <button @click="openGallery">Open gallery</button>
   </micra-glightbox>
   ```

3. Set `state.images` (or `data-seed` on the root) before `Micra.start()`, then call
   `Micra.start()` once after the scripts above.

**Seeding the gallery.** Either set `state.images` from the host before
`Micra.start()`, or put a JSON array on `data-seed` on the root and the wrapper loads
it once. Each image is `{ id, href, thumb, title, description }`.

> **`data-type="image"` matters.** GLightbox infers a slide's type from the file
> extension in `href`. URLs without a recognized image extension — including
> `data:` URIs and many CMS/CDN URLs that hide the extension behind a query string —
> are treated as `external` (an iframe) unless you force the type. Set
> `data-type="image"` (or `video`) on each anchor. The demo uses inline SVG data
> URIs precisely to show this.

## What you get

The wrapper exposes:

- `state.images` — the gallery, the single source of truth for the rendered grid.
  Replace it (don't mutate in place) to add/remove images.
- `state.open` / `state.index` — mirrored from GLightbox's own events, so they stay
  in sync as the user navigates.
- `count()` / `isOpen()` / `position()` — derived, for readouts and disabled states.
- `viewing()` — "Viewing image X of N" while open, the count while closed.
- `openGallery(index?)` — opens the lightbox programmatically (`openAt`, defaults to
  the first slide).
- `reloadGallery()` — call after you change `state.images` post-init so GLightbox
  rescans the new anchors (it binds at init, so new anchors need a `reload()`).

## Theming

- The skin references only `--micra-*` tokens, so it follows your theme. Recolor by
  overriding tokens — no edits here:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

- **Two surfaces.** The thumbnail grid (`.micra-glightbox-grid`) is fully ours and
  token-styled top to bottom. The lightbox chrome (overlay, caption, nav/close
  buttons) is GLightbox's; the skin re-tints the parts that read cleanly with tokens
  (`--micra-overlay` backdrop, `--micra-surface`/`--micra-fg`/`--micra-muted`
  caption, accent nav buttons). We don't fight the library — the grid is the main
  token surface.
- **Dark mode** works: every override uses tokens, so the grid and the re-tinted
  chrome both follow `[data-theme="dark"]` (and the OS preference).
- **Full control** — `glightbox.css` is yours; edit it.

## Server fit

Render the gallery anchors however your server does (the `data-each` template mirrors
a server loop), give each the `glightbox` class and the GLightbox `data-*` attributes,
and the wrapper adds the reactive readout and programmatic open on top — no build
step. The wrapper cleans up after itself (`onCreate` inits GLightbox, `onDestroy`
destroys it), so it's safe under `Micra.autoCleanup()` when htmx or Astro swaps the
island out.

## Accessibility

GLightbox handles focus trapping, `Esc` to close, and arrow-key navigation in the
overlay. Give each thumbnail a meaningful `alt` (the wrapper binds `alt` from the
image title). The grid items are real `<a>` elements, so they're keyboard-focusable
and show a token focus ring.

## License

GLightbox is **MIT** (biati digital). This wrapper and skin are MIT too — see `LICENSE` in the repo root.
