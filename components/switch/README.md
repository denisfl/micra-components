# Switch

Accessible toggle: `role="switch"` with `aria-checked`, toggles on click, Enter,
and Space (Space without scrolling the page), respects a disabled state, and
emits a `change` event with the new boolean. Headless behavior in `define.js`;
the look is a default skin in `switch.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="switch.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup (set the initial state with `data-checked` / `data-disabled`):

   ```html
   <label class="row" id="notify-label">Notifications</label>

   <micra-switch data-checked>
     <button
       class="micra-switch"
       type="button"
       role="switch"
       aria-labelledby="notify-label"
       data-bind="aria-checked:checked ? 'true' : 'false', aria-disabled:disabled ? 'true' : 'false',
                  data-state:checked ? 'checked' : 'unchecked'"
       @click="toggle"
       @keydown.space.prevent="toggle"
     >
       <span class="micra-switch__thumb"></span>
     </button>
   </micra-switch>
   ```

3. Call `Micra.start()` once, after your components are defined.

The component owns the button only — pair it with your own `<label>`/`<span>`
text and associate the two with `aria-labelledby`. Multiple switches on one page
work out of the box — each `<micra-switch>` is an independent instance
with its own state.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `switch.css`. It is yours.
- **Tailwind (optional)** — the state lives in `data-state` and `aria-checked`,
  so you can skip `switch.css` and style with native variants instead:
  `class="… data-[state=checked]:bg-indigo-600"`.

## Accessibility

`role="switch"` + `aria-checked` reflecting the value, `aria-disabled` when off.
Toggles on click, Enter, and Space; Space is prevented from scrolling the page. A
visible focus ring appears on `:focus-visible`. Disabled switches are dimmed and
show `not-allowed`. Label the control with `aria-labelledby` (or wrap it in a
`<label>`). Motion respects `prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
