# Slide-over

A modal side drawer on a native `<dialog>`: the panel slides in from an edge
instead of centering, and the behavior is the modal's — the page behind is inert
(Tab stays inside), Escape closes, focus returns to the trigger, backdrop click
closes, page scroll is locked. Headless behavior in `define.js`; the look is a
default skin in `slideover.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (right and left drawers, light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="slideover.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Pick the edge with `data-side` (`right` default, or
   `left` / `top` / `bottom`) and an optional `data-size`:

   ```html
   <micra-slideover data-side="right" data-size="24rem">
     <button class="micra-btn" @click="open">Filters</button>

     <dialog
       class="micra-slideover"
       data-ref="dialog"
       aria-labelledby="so-title"
       data-bind="data-side:side()"
       @close="closed"
       @click.self="close"
     >
       <div class="micra-slideover__panel"
            data-bind="data-side:side(), style:panelStyle()">
         <header class="micra-slideover__head">
           <h2 id="so-title">Filters</h2>
           <button class="micra-slideover__close" @click="close" aria-label="Close">&times;</button>
         </header>
         <div class="micra-slideover__body">
           <p>Your content here.</p>
         </div>
         <footer class="micra-slideover__foot">
           <button class="micra-btn" @click="close">Apply</button>
         </footer>
       </div>
     </dialog>
   </micra-slideover>
   ```

3. Call `Micra.start()` once, after your components are defined.

**Sizing.** `data-size` sets the panel's width (`left`/`right`) or height
(`top`/`bottom`) — any CSS length, e.g. `24rem`, `30vw`, `400px`. Omit it and the
skin's default (`24rem`) applies. The value rides on a `--micra-slideover-size`
custom property, so you can also set it in CSS instead of markup.

Multiple slide-overs on one page work out of the box — each
`<micra-slideover>` is an independent instance with its own state.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Resize one instance** — set the size token on the root (or any ancestor):

  ```css
  .my-drawer { --micra-slideover-size: 30rem; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `slideover.css`. It is yours.
- **Tailwind (optional)** — the open state is the dialog's `[open]` and the edge
  is `data-side`, so you can skip `slideover.css` and style with variants instead:
  `class="… open:… data-[side=left]:left-0"`.

## Accessibility

A native modal `<dialog>`, labelled by its heading. Focus moves into the panel on
open; Tab stays inside because the page behind is inert; Escape closes; focus
returns to the trigger (or, when the drawer was opened from code, wherever the
browser restores it). Page scroll is locked while open. Motion respects
`prefers-reduced-motion` (tokens zero the duration), so the panel arrives instantly
without disabling the component.

## License

MIT — see `LICENSE` in the repo root.
