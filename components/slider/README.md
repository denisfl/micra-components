# Slider

Accessible single-thumb range: `role="slider"` with `aria-valuemin/now/max`,
keyboard (arrows, Home, End), pointer drag that continues outside the thumb,
value clamped to `[min, max]` and snapped to `step`, and a `change` event with
the new number. Headless behavior in `define.js`; the look is a default skin in
`slider.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="slider.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup (set the range with `data-min` / `data-max` / `data-step`
   and the initial position with `data-value`):

   ```html
   <label id="vol-label">Volume</label>

   <micra-slider data-min="0" data-max="100" data-step="1" data-value="40">
     <div class="micra-slider" data-ref="track" @pointerdown="dragStart">
       <div class="micra-slider__track"></div>
       <div class="micra-slider__fill" data-bind="style:fillStyle()"></div>
       <div
         class="micra-slider__thumb"
         role="slider"
         tabindex="0"
         aria-orientation="horizontal"
         aria-labelledby="vol-label"
         data-ref="thumb"
         data-bind="style:thumbStyle(),
                    aria-valuemin:min, aria-valuenow:value, aria-valuemax:max"
         @keydown.right.prevent="increment"
         @keydown.up.prevent="increment"
         @keydown.left.prevent="decrement"
         @keydown.down.prevent="decrement"
         @keydown.home.prevent="setMin"
         @keydown.end.prevent="setMax"
       ></div>
     </div>
   </micra-slider>
   ```

3. Call `Micra.start()` once, after your components are defined.

The component owns the slider only — pair it with your own `<label>` and live
value text (bind it with `data-text="valueText()"` on an element inside the same
`data-component`). Multiple sliders on one page work out of the box — each
`<micra-slider>` is an independent instance with its own state.

`change` fires on **every** value change — each keyboard step and each drag move,
not only on release — so a bound display stays live. Debounce downstream if a
consumer only wants the committed value.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `slider.css`. It is yours.
- **Tailwind (optional)** — the value lives in `aria-valuenow` and the position
  in inline `left`/`width`, so you can skip `slider.css` and style the track,
  fill, and thumb with utility classes instead.

## Accessibility

`role="slider"` + `tabindex="0"` on the thumb, with `aria-valuemin`,
`aria-valuenow`, and `aria-valuemax` reflecting the live range as numbers, plus
`aria-orientation="horizontal"`. Label the thumb with `aria-label` or
`aria-labelledby`. Arrow keys move by `step` (Right/Up up, Left/Down down), Home
jumps to the minimum, End to the maximum; every change is clamped and
step-snapped. Pointer drag starts anywhere on the track and continues even when
the cursor leaves the thumb. A visible focus ring appears on `:focus-visible`.
Motion respects `prefers-reduced-motion` (tokens zero the duration), and the
thumb position itself is never transitioned, so dragging tracks the cursor
exactly.

## License

MIT — see `LICENSE` in the repo root.
