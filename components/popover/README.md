# Popover

Accessible, non-modal anchored panel: a trigger opens a `role="dialog"` popup of
arbitrary content (a form, filters, rich content) positioned under it. Focus
moves into the panel on open and returns to the trigger on close; Escape and
outside-click close it. Headless behavior in `define.js`; the look is a default
skin in `popover.css` driven by `theme/theme.css` tokens.

It is the generic-content sibling of the Dropdown — use the Dropdown for a menu
of actions, the Popover for everything else.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="popover.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. The root `.micra-popover` is the positioning context — it
   must wrap **only** the trigger and the panel:

   ```html
   <micra-popover class="micra-popover" @pointerdown.outside="close">
     <button
       class="micra-popover__trigger"
       data-ref="trigger"
       aria-haspopup="dialog"
       aria-controls="popover-panel"
       data-bind="aria-expanded:isOpen ? 'true' : 'false'"
       @click="toggle"
     >
       Filters
     </button>

     <div
       class="micra-popover__panel"
       id="popover-panel"
       role="dialog"
       aria-labelledby="popover-title"
       data-ref="panel"
       tabindex="-1"
       data-bind="data-state:isOpen ? 'open' : 'closed'"
       @keydown.escape="close"
     >
       <h2 id="popover-title" class="micra-popover__title">Filters</h2>
       <!-- Your content here. -->
       <button class="micra-btn" @click="close">Apply</button>
     </div>
   </micra-popover>
   ```

3. Call `Micra.start()` once, after your components are defined.

Multiple popovers on one page work out of the box — each
`<micra-popover>` is an independent instance with its own state.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `popover.css`. It is yours.
- **Tailwind (optional)** — the state lives in `data-state`, so you can skip
  `popover.css` and style with native variants instead:
  `class="… data-[state=open]:opacity-100"`.

## Accessibility

The trigger has `aria-haspopup="dialog"`, `aria-controls` pointing at the panel,
and `aria-expanded` reflecting open/closed. The panel is `role="dialog"` labelled
by its heading. Focus moves into the panel on open and returns to the trigger on
close; Escape and outside-click close it. Motion respects
`prefers-reduced-motion` (tokens zero the duration). The panel is
non-interactive when closed (`visibility: hidden`).

**Non-modal by design.** Unlike the modal, the popover does **not** trap focus or
lock scrolling — Tab moves through the panel and may leave it, and the rest of the
page stays interactive. Reach for the modal when you need an exclusive,
focus-trapping dialog.

## License

MIT — see `LICENSE` in the repo root.
