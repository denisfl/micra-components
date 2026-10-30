# Combobox

Accessible autocomplete: type to filter, arrow keys to move the highlight, Enter
to select, Escape to close (keeping your text), click or outside-click to
dismiss. Follows the WAI-ARIA combobox pattern. Headless behavior in `define.js`;
the look is a default skin in `combobox.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="combobox.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Seed `state.options` from your data, give the listbox an
   id, and point `aria-controls` at it:

   ```html
   <micra-combobox class="micra-combobox" @pointerdown.outside="close">
     <input
       class="micra-combobox__input"
       role="combobox"
       aria-autocomplete="list"
       aria-controls="cb-listbox"
       placeholder="Search frameworks…"
       data-model="query"
       data-bind="aria-expanded:open ? 'true' : 'false', aria-activedescendant:activeDescendant()"
       @input="onInput"
       @focus="onFocus"
       @keydown.down.prevent="next"
       @keydown.up.prevent="prev"
       @keydown.enter.prevent="choose"
       @keydown.escape="close"
       @keydown.tab="close"
     />

     <ul class="micra-combobox__listbox" id="cb-listbox" role="listbox" data-bind="data-state:open ? 'open' : 'closed'">
       <template data-each="filtered()" data-key="id">
         <li
           class="micra-combobox__option"
           role="option"
           data-bind="id:'cb-option-' + item.id, aria-selected:selectedId === item.id ? 'true' : 'false', data-state:item.id === activeId ? 'active' : ''"
           data-text="item.label"
           @click="select(item.id)"
           @mousemove="setActive(item.id)"
         ></li>
       </template>
       <li class="micra-combobox__empty" role="presentation" data-if="noResults()">No results</li>
     </ul>
   </micra-combobox>

   <p>Selected: <strong data-text="selectedLabel()"></strong></p>
   ```

   Set the options in your own bootstrap before `Micra.start()`, e.g. via a
   `data-options` attribute you read in `onCreate`, or by editing the seed array
   in `define.js`. The demo seeds them inline — see `index.html`.

3. Call `Micra.start()` once, after your components are defined.

Multiple comboboxes on one page work out of the box — each
`<micra-combobox>` is an independent instance with its own state. Give
each one a distinct `aria-controls` / listbox `id`.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `combobox.css`. It is yours.
- **Tailwind (optional)** — the highlight lives in `data-state` and selection in
  `aria-selected`, so you can skip `combobox.css` and style with native variants:
  `class="… data-[state=active]:bg-indigo-600 aria-selected:font-semibold"`.

## Accessibility

The input is `role="combobox"` with `aria-autocomplete="list"`, `aria-expanded`
bound to the open state, `aria-controls` pointing at the listbox, and
`aria-activedescendant` tracking the highlighted option's id. The list is
`role="listbox"`; each row is `role="option"` with a stable id and
`aria-selected`. The active option is tracked **by id**, so filtering can never
desync the highlight. Arrow keys wrap; Enter selects the active option; Escape
closes the list and keeps both the typed text and input focus; Tab closes
without blocking focus from leaving.

## License

MIT — see `LICENSE` in the repo root.
