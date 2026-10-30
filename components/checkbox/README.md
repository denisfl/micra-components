# Checkbox group

Accessible checkbox group with a tri-state "select all": per-item toggle, a
parent control that reads checked / mixed / unchecked, disabled items skipped,
Space to toggle, and a `change` event with the checked ids. Headless behavior in
`define.js`; the look is a default skin in `checkbox.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="checkbox.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Items come from `state.options`
   (`{ id, label[, disabled] }`) in `define.js`; `state.checked` is the array of
   checked ids:

   ```html
   <micra-checkbox class="micra-checkbox">
     <span class="micra-checkbox__label" id="perms-label">Permissions</span>

     <div role="group" aria-labelledby="perms-label">
       <button class="micra-checkbox__item micra-checkbox__all" type="button"
               role="checkbox" aria-labelledby="cb-all-label"
               @click="toggleAll" @keydown.space.prevent="toggleAll"
               data-bind="aria-checked:allState(), data-state:allDataState()">
         <span class="micra-checkbox__box" aria-hidden="true"></span>
         <span class="micra-checkbox__text" id="cb-all-label">Select all</span>
       </button>

       <div class="micra-checkbox__options">
         <template data-each="options" data-key="id">
           <button class="micra-checkbox__item" type="button" role="checkbox"
                   @click="toggle(item.id)" @keydown.space.prevent="toggle(item.id)"
                   data-bind="id:'cb-' + item.id, aria-labelledby:'cb-' + item.id + '-label', aria-checked:isChecked(item.id) ? 'true' : 'false', aria-disabled:item.disabled ? 'true' : 'false', data-state:isChecked(item.id) ? 'checked' : 'unchecked'">
             <span class="micra-checkbox__box" aria-hidden="true"></span>
             <span class="micra-checkbox__text" data-bind="id:'cb-' + item.id + '-label'" data-text="item.label"></span>
           </button>
         </template>
       </div>
     </div>

     <p class="status" data-text="checkedCount() + ' selected'"></p>
   </micra-checkbox>
   ```

3. Call `Micra.start()` once, after your components are defined.

Wire your own options by editing `state.options`, and listen for changes with
`this.on('change', ids => …)` (the payload is the array of checked ids). The
tri-state is computed for you: `allState()` returns the ARIA string, `isChecked`,
`checkedCount`, and `allChecked` are the derived helpers.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

  The box fill, the check, and the dash all follow `--micra-primary` /
  `--micra-primary-fg`; the focus ring follows `--micra-ring`.

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `checkbox.css`. It is yours. The check and the dash are
  CSS shapes drawn from tokens, not images, so they recolor with the theme.
- **Tailwind (optional)** — the state lives in `data-state` and `aria-checked`, so
  you can skip `checkbox.css` and style with native variants instead:
  `class="… data-[state=checked]:bg-indigo-600 data-[state=mixed]:bg-indigo-600"`.

## Accessibility

`role="group"` labelled by the visible group label. Each item is a
`role="checkbox"` with `aria-checked` emitted as the string `"true"` / `"false"`;
the "select all" control adds the third value `"mixed"` for the indeterminate
state. `aria-disabled="true"` marks disabled items, and they are skipped by both
toggles. Space toggles the focused box (Enter works too, since each is a native
`<button>`); the focus ring is visible via `--micra-ring`. Disabled items are
dimmed and `not-allowed`.

## License

MIT — see `LICENSE` in the repo root.
