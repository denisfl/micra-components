# Popover

Accessible, non-modal anchored panel on the native Popover API: a trigger opens a
`role="dialog"` popup of arbitrary content (a form, filters, rich content) anchored
under it. Focus moves into the panel on open and returns to the trigger on close;
the browser closes it on Escape or an outside click and shows it in the top layer.
Headless behavior in `define.js`; the look is a default skin in `popover.css`
driven by `theme/theme.css` tokens.

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

2. Drop in the markup (the panel's `id` must match the trigger's `popovertarget`):

   ```html
   <micra-popover class="micra-popover">
     <button
       class="micra-popover__trigger"
       data-ref="trigger"
       aria-haspopup="dialog"
       aria-controls="popover-panel"
       data-bind="aria-expanded:isOpen ? 'true' : 'false'"
       popovertarget="popover-panel"
     >
       Filters
     </button>

     <div
       class="micra-popover__panel"
       id="popover-panel"
       role="dialog"
       popover
       aria-labelledby="popover-title"
       data-ref="panel"
       tabindex="-1"
       @toggle="onToggle"
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
- **Tailwind (optional)** — the open state is the native `:popover-open`, so you
  can skip `popover.css` and style the panel with your own classes.

## Accessibility

The trigger has `aria-haspopup="dialog"`, `aria-controls` pointing at the panel,
and `aria-expanded` reflecting open/closed. The panel is `role="dialog"` labelled
by its heading. Focus moves into the panel on open and returns to the trigger on
close; Escape and outside-click close it. Motion respects
`prefers-reduced-motion` (tokens zero the duration).

Needs Micra 2.14 or later.

**Non-modal by design.** Unlike the modal, the popover does **not** trap focus or
lock scrolling — Tab moves through the panel and may leave it, and the rest of the
page stays interactive. Reach for the modal when you need an exclusive,
focus-trapping dialog.

## License

MIT — see `LICENSE` in the repo root.
