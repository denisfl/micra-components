# Slide-over

A modal side drawer: the panel slides in from an edge instead of centering, but
the behavior is modal-grade — focus trap, focus return to the trigger, Escape to
close, backdrop click to close, body scroll lock. Headless behavior in
`define.js`; the look is a default skin in `slideover.css` driven by
`theme/theme.css` tokens.

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
   <micra-slideover @keydown.escape.window="close" @keydown.tab.window="trapTab" data-side="right" data-size="24rem">
     <button class="micra-btn" @click="open">Filters</button>

     <div class="micra-slideover"
          data-bind="data-state:open ? 'open' : 'closed', data-side:side()"
          @click.self="close">
       <div class="micra-slideover__panel" role="dialog" aria-modal="true"
            aria-labelledby="so-title" data-ref="panel" tabindex="-1"
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
     </div>
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
- **Tailwind (optional)** — the state lives in `data-state` and the edge in
  `data-side`, so you can skip `slideover.css` and style with native variants
  instead: `class="… data-[state=open]:translate-x-0 data-[side=left]:left-0"`.

## Accessibility

`role="dialog"` + `aria-modal`, labelled by the heading. Focus moves into the
panel on open and returns to the trigger on close; Tab is trapped inside; Escape
closes. The backdrop is non-interactive when closed (`visibility: hidden`), and
body scroll is locked while open and restored on close (and on destroy). Motion
respects `prefers-reduced-motion` (tokens zero the duration), so the panel
arrives instantly without disabling the component.

## License

MIT — see `LICENSE` in the repo root.
