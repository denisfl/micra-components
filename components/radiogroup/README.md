# Radio group

Accessible single-select radio group: roving tabindex, arrow / Home / End
keyboard, automatic activation (the selected radio takes focus), and a `change`
event with the selected option. Headless behavior in `define.js`; the look is a
default skin in `radiogroup.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="radiogroup.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. The group is data-driven — `state.options` holds the
   `{ id, label, description }` items (add `disabled: true` to skip one), and
   `state.value` is the selected id (defaults to the first enabled option). The
   radios render from that list, and a visible label is wired up via
   `aria-labelledby`:

   ```html
   <micra-radiogroup class="micra-radiogroup">
     <span class="micra-radiogroup__label" id="plan-label">Choose a plan</span>

     <div class="micra-radiogroup__options" role="radiogroup" aria-labelledby="plan-label"
          @keydown.down.prevent="next"  @keydown.right.prevent="next"
          @keydown.up.prevent="prev"    @keydown.left.prevent="prev"
          @keydown.home.prevent="first" @keydown.end.prevent="last"
          @keydown.space.prevent="selectFocused">
       <template data-each="options" data-key="id">
         <button class="micra-radiogroup__radio" type="button" role="radio"
                 @click="select(item.id)"
                 data-bind="id:'radio-' + item.id, data-id:item.id, aria-checked:value === item.id ? 'true' : 'false', aria-disabled:item.disabled ? 'true' : 'false', tabindex:value === item.id ? 0 : -1, data-state:value === item.id ? 'checked' : 'unchecked'">
           <span class="micra-radiogroup__indicator" aria-hidden="true"></span>
           <span class="micra-radiogroup__text">
             <span class="micra-radiogroup__title" data-text="item.label"></span>
             <span class="micra-radiogroup__description" data-text="item.description"></span>
           </span>
         </button>
       </template>
     </div>
   </micra-radiogroup>
   ```

3. Call `Micra.start()` once, after your components are defined.

Selection emits a `change` event carrying the selected option; subscribe with
`Micra.on('change', …)` or an instance's `this.on`. To supply your own options,
edit the `state.options` array in `define.js` (replace the array — never mutate
it in place). Multiple groups on one page work out of the box — each
`<micra-radiogroup>` is an independent instance.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `radiogroup.css`. It is yours.
- **Tailwind (optional)** — the selected radio lives in `data-state`, so you can
  skip `radiogroup.css` and style with native variants instead:
  `class="… data-[state=checked]:border-current"`.

## Accessibility

`role="radiogroup"` is labelled by a visible heading (`aria-labelledby`) and
wraps the `role="radio"` buttons, each carrying `aria-checked`. Only the selected
radio is in the tab order (roving tabindex); arrow keys move the selection
between enabled radios and wrap, Home / End jump to the first / last enabled
radio, and Space selects the focused one. Activation is automatic — changing the
selection moves real focus to the newly selected radio. Disabled radios
(`aria-disabled`) are skipped by both pointer and keyboard.

## License

MIT — see `LICENSE` in the repo root.
