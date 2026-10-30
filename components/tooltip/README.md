# Tooltip

Accessible tooltip: appears on hover **and** keyboard focus after a short open
delay, hides immediately on leave, blur, or Escape. Headless behavior in
`define.js`; the look is a default skin in `tooltip.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="tooltip.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. The trigger points at the bubble with `aria-describedby`;
   the bubble carries a matching `id` and `role="tooltip"`:

   ```html
   <micra-tooltip
     class="micra-tooltip-wrap"
     @mouseenter="open"
     @mouseleave="close"
     @focusin="open"
     @focusout="close"
     @keydown.escape="close"
   >
     <button class="micra-btn" aria-describedby="tip-save">Save</button>

     <span
       class="micra-tooltip"
       id="tip-save"
       role="tooltip"
       data-bind="data-state:open ? 'open' : 'closed'"
     >
       Saves your changes to the server.
     </span>
   </micra-tooltip>
   ```

3. Call `Micra.start()` once, after your components are defined.

Multiple tooltips on one page work out of the box — each `<micra-tooltip>`
is an independent instance with its own state.

### Open delay

The hover/focus delay defaults to 400ms. Override it per instance with the
`data-delay` attribute (milliseconds):

```html
<micra-tooltip data-delay="700" …>
```

Leaving, blurring, or pressing Escape cancels a pending open and hides
immediately, regardless of the delay.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-surface: #1f2937; --micra-fg: #f9fafb; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `tooltip.css`. It is yours.
- **Tailwind (optional)** — the state lives in `data-state`, so you can skip
  `tooltip.css` and style with native variants instead:
  `class="… data-[state=open]:opacity-100"`.

## Accessibility

The bubble is a `role="tooltip"` referenced by the trigger's `aria-describedby`,
so it is announced as the trigger's description. It appears on both pointer hover
and keyboard focus, and Escape dismisses it while focus stays on the trigger.
Motion respects `prefers-reduced-motion` (tokens zero the duration). The bubble
is non-interactive when closed (`visibility: hidden`, `pointer-events: none`).

## License

MIT — see `LICENSE` in the repo root.
