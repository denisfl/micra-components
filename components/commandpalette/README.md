# Command palette

Fuzzy actions, keyboard-first. A Cmd/Ctrl+K launcher: open it, type to fuzzily
filter your commands, arrow keys to move the highlight, Enter to run, Escape to
close. It is a modal dialog (focus trap, focus return, scroll lock) wrapping a
WAI-ARIA combobox (input + listbox, active option tracked by
`aria-activedescendant`). Headless behavior in `define.js`; the look is a default
skin in `commandpalette.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark). Press Cmd/Ctrl+K.

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="commandpalette.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Seed `state.commands` from a `data-commands` JSON array
   (each command is `{ id, label, group?, keywords?, hint? }`), give the listbox
   an id, and point `aria-controls` at it:

   ```html
   <micra-commandpalette @keydown.escape.window="close" @keydown.tab.window="trapTab" @keydown.meta.k.window.prevent="toggle" @keydown.ctrl.k.window.prevent="toggle"
     data-commands='[
       {"id":"settings","group":"Navigation","label":"Open Settings","keywords":["preferences","config"],"hint":"g s"},
       {"id":"deploy","group":"Actions","label":"Deploy to Production","keywords":["ship","release"],"hint":"Ctrl D"}
     ]'
   >
     <button class="micra-btn" @click="open">Open command palette</button>

     <div class="micra-cmdk" data-bind="data-state:open ? 'open' : 'closed'" @click.self="close">
       <div class="micra-cmdk__panel" role="dialog" aria-modal="true"
            aria-label="Command palette" data-ref="panel" tabindex="-1">
         <input
           class="micra-cmdk__input"
           role="combobox"
           aria-autocomplete="list"
           aria-controls="cmdk-listbox"
           placeholder="Type a command or search…"
           data-ref="input"
           data-model="query"
           data-bind="aria-expanded:open ? 'true' : 'false', aria-activedescendant:activeDescendant()"
           @input="onInput"
           @keydown.down.prevent="next"
           @keydown.up.prevent="prev"
           @keydown.enter.prevent="run"
           @keydown.escape="close"
         />

         <ul class="micra-cmdk__listbox" id="cmdk-listbox" role="listbox" aria-label="Commands">
           <template data-each="filtered()" data-key="id">
             <li class="micra-cmdk__row" role="presentation">
               <div class="micra-cmdk__group" role="presentation"
                    data-if="firstInGroup(item)" data-text="item.group"></div>
               <div
                 class="micra-cmdk__option"
                 role="option"
                 data-bind="id:'cmdk-option-' + item.id, aria-selected:item.id === activeId ? 'true' : 'false', data-state:item.id === activeId ? 'active' : ''"
                 @click="choose(item.id)"
                 @mousemove="setActive(item.id)"
               >
                 <span class="micra-cmdk__label" data-text="item.label"></span>
                 <span class="micra-cmdk__hint" data-if="item.hint" data-text="item.hint"></span>
               </div>
             </li>
           </template>
           <li class="micra-cmdk__empty" role="presentation" data-if="noResults()">No commands</li>
         </ul>
       </div>
     </div>
   </micra-commandpalette>
   ```

3. Call `Micra.start()` once, after your components are defined. Listen for the
   `run` event to route the chosen command:

   ```js
   Micra.start();
   const root = document.querySelector('[data-component="commandpalette"]');
   Micra.instances().get(root).on('run', (cmd) => {
     // route on cmd.id — navigate, dispatch, call an API…
     console.log('run', cmd.id);
   });
   ```

Cmd/Ctrl+K opens the palette from anywhere on the page (a document-level keydown
listener, added in `onCreate` and removed in `onDestroy`); the trigger button
opens it too. The demo seeds commands inline — see `index.html`.

## Matching & ranking

`filtered()` is a fuzzy, ranked filter. The query matches a command when it is a
case-insensitive **subsequence** of the command's label or one of its `keywords`
— so "dtp" finds "Deploy to Production". Results are ranked by a score (lower is
better): a match that starts early and runs contiguously beats one that starts
late or skips characters, so "set" ranks "Settings" above "Reset password". Ties
keep the original seed order, and an empty query lists every command in seed
order. Give a command `keywords` to make it findable by terms that aren't in its
visible label.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `commandpalette.css`. It is yours.
- **Tailwind (optional)** — the highlight lives in `data-state` and the open
  state on the overlay, so you can skip `commandpalette.css` and style with
  native variants: `class="… data-[state=active]:bg-indigo-600"` on options,
  `class="… data-[state=open]:opacity-100"` on the overlay.

## Accessibility

A WAI-ARIA combobox nested inside a dialog. The overlay is `role="dialog"` with
`aria-modal` and an `aria-label`; focus moves into the input on open and returns
to whatever was focused before on close, Tab is trapped inside the panel, and
Escape closes. The input is `role="combobox"` with `aria-autocomplete="list"`,
`aria-expanded` bound to the open state, `aria-controls` pointing at the listbox,
and `aria-activedescendant` tracking the highlighted command's id. The list is
`role="listbox"`; each row is `role="option"` with a stable id and
`aria-selected`. The active command is tracked **by id**, so fuzzy filtering can
never desync the highlight; arrow keys wrap and scroll the active option into
view; Enter runs it. Motion respects `prefers-reduced-motion` (tokens zero the
duration). The overlay is non-interactive when closed (`visibility: hidden`).

## License

MIT — see `LICENSE` in the repo root.
