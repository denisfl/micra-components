# Progress

Accessible progress bar (WAI-ARIA `progressbar`): a read-only display of a value
between a min and a max, with a determinate fill and an indeterminate (animated)
mode. Headless behavior in `define.js`; the look is a default skin in
`progress.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="progress.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. **Determinate** (set the range with `data-min` /
   `data-max` and the starting value with `data-value`):

   ```html
   <micra-progress data-min="0" data-max="100" data-value="40">
     <div class="micra-progress" role="progressbar" aria-label="Upload"
          data-bind="aria-valuemin:min, aria-valuenow:value, aria-valuemax:max">
       <div class="micra-progress__track">
         <div class="micra-progress__fill" data-bind="style:barStyle()"></div>
       </div>
     </div>
   </micra-progress>
   ```

   **Indeterminate** (work is happening but the amount is unknown) — add
   `data-indeterminate="true"`, set `data-state="indeterminate"` and
   `aria-busy="true"` on the wrapper, and omit `aria-valuenow`:

   ```html
   <micra-progress data-indeterminate="true">
     <div class="micra-progress" role="progressbar" aria-label="Syncing"
          aria-busy="true" data-state="indeterminate">
       <div class="micra-progress__track">
         <div class="micra-progress__fill"></div>
       </div>
     </div>
   </micra-progress>
   ```

3. Call `Micra.start()` once, after your components are defined.

Drive the value from your own code via the instance API: `setValue(n)` clamps into
`[min, max]` and emits a `change` event with the new number; `inc(d)` / `dec(d)`
step it. The fill width is a method (`barStyle()`) and updates automatically when
the value changes — there is no manual re-render. Multiple bars on one page work
out of the box, each an independent instance.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `progress.css`. It is yours.
- **Tailwind (optional)** — the indeterminate state lives in `data-state`, so you
  can skip `progress.css` and style with native variants instead:
  `class="… data-[state=indeterminate]:animate-…"`.

## Accessibility

`role="progressbar"` with `aria-valuemin` / `aria-valuenow` / `aria-valuemax`
(numbers) in determinate mode. In indeterminate mode there is no `aria-valuenow`;
the bar carries `aria-busy="true"` instead, signalling "in progress, amount
unknown". Always give the bar a name with `aria-label` or `aria-labelledby`. The
fill transition respects `prefers-reduced-motion` (tokens zero the duration), and
the indeterminate slide animation is gated behind `prefers-reduced-motion:
no-preference`, so reduced-motion users get a static bar rather than a perpetual
loop.

## License

MIT — see `LICENSE` in the repo root.
