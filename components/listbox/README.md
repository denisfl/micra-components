# Listbox

Accessible custom select: a button shows the chosen value and opens a popup list;
arrow keys move the highlight, Home/End jump to the ends, Enter or Space selects,
Escape closes, click or outside-click dismisses. It is the combobox without the
text input — the WAI-ARIA "Select-Only Combobox" pattern. Headless behavior in
`define.js`; the look is a default skin in `listbox.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="listbox.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Seed `state.options` from your data (via `data-options`),
   give the list an id, and point `aria-controls` at it. Options are
   `{ id, label, disabled? }`:

   ```html
   <micra-listbox @pointerdown.outside="close"
     data-options='[{"id":"react","label":"React"},{"id":"vue","label":"Vue"}]'
   >
     <div class="micra-listbox">
       <button
         class="micra-listbox__button"
         role="combobox"
         aria-haspopup="listbox"
         aria-controls="lb-listbox"
         data-ref="button"
         data-bind="aria-expanded:open ? 'true' : 'false'"
         @click="toggle"
         @keydown.down.prevent="open"
         @keydown.up.prevent="open"
         @keydown.enter.prevent="toggle"
         @keydown.space.prevent="toggle"
       >
         <span
           class="micra-listbox__value"
           data-placeholder="Select a framework"
           data-text="selectedLabel()"
         ></span>
         <span class="micra-listbox__caret" aria-hidden="true">▾</span>
       </button>

       <ul
         class="micra-listbox__list"
         id="lb-listbox"
         role="listbox"
         data-ref="list"
         tabindex="-1"
         data-bind="data-state:open ? 'open' : 'closed', aria-activedescendant:activeDescendant()"
         @keydown.down.prevent="next"
         @keydown.up.prevent="prev"
         @keydown.home.prevent="first"
         @keydown.end.prevent="last"
         @keydown.enter.prevent="choose"
         @keydown.space.prevent="choose"
         @keydown.escape="close"
       >
         <template data-each="options" data-key="id">
           <li
             class="micra-listbox__option"
             role="option"
             data-bind="id:'lb-option-' + item.id, aria-selected:value === item.id ? 'true' : 'false', aria-disabled:item.disabled ? 'true' : 'false', data-state:item.id === activeId ? 'active' : ''"
             @click="select(item.id)"
           >
             <span data-text="item.label"></span>
             <span class="micra-listbox__check" aria-hidden="true">✓</span>
           </li>
         </template>
       </ul>
     </div>

     <p>Selected: <strong data-text="selectedLabel() || '—'"></strong></p>
   </micra-listbox>
   ```

   The `.micra-listbox` element is the positioning context — it must wrap **only**
   the button and the list, so the popup anchors under the button. Sibling content
   lives outside it.

   By default nothing is selected and the button shows its placeholder. To
   preselect, add `data-value="<id>"`; to default to the first enabled option, add
   `data-select-first`. Listen for the `change` event (`this.on('change', opt)`)
   to react to the user's choice, where `opt` is the chosen option object.

3. Call `Micra.start()` once, after your components are defined.

Multiple listboxes on one page work out of the box — each
`<micra-listbox>` is an independent instance with its own state. Give
each one a distinct `aria-controls` / list `id`.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `listbox.css`. It is yours.
- **Tailwind (optional)** — open/closed lives in `data-state`, the highlight in
  `data-state="active"`, and selection in `aria-selected`, so you can skip
  `listbox.css` and style with native variants:
  `class="… data-[state=active]:bg-indigo-600 aria-selected:font-semibold"`.

## Accessibility

The button is `role="combobox"` with `aria-haspopup="listbox"`, `aria-expanded`
bound to the open state, and `aria-controls` pointing at the list. The popup is
`role="listbox"` carrying `aria-activedescendant`, which tracks the highlighted
option's id. Each row is `role="option"` with a stable id, `aria-selected` on the
committed choice, and `aria-disabled` where applicable. The active option is
tracked **by id**, so the highlight never desyncs, and it is scrolled into view as
you navigate. Arrow keys move and wrap (skipping disabled options); Home/End jump
to the first/last enabled option; Enter or Space selects the active option and
returns focus to the button; Escape closes and returns focus; outside-click
dismisses.

## License

MIT — see `LICENSE` in the repo root.
