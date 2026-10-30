# Tabs

Accessible tabs: roving tabindex, arrow / Home / End keyboard, automatic
activation (the selected tab takes focus), and a single visible panel. Headless
behavior in `define.js`; the look is a default skin in `tabs.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="tabs.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Tabs are data-driven — `state.tabs` holds the
   `{ id, label, body }` items (add `disabled: true` to skip one), and
   `state.selected` is the selected id (defaults to the first enabled tab). The
   tablist and panels both render from the same list:

   ```html
   <micra-tabs class="micra-tabs">
     <div class="micra-tabs__list" role="tablist" aria-label="Settings"
          @keydown.left.prevent="prev"  @keydown.up.prevent="prev"
          @keydown.right.prevent="next" @keydown.down.prevent="next"
          @keydown.home.prevent="first" @keydown.end.prevent="last">
       <template data-each="tabs" data-key="id">
         <button class="micra-tabs__tab" type="button" role="tab"
                 @click="select(item.id)"
                 data-bind="id:'tab-' + item.id, aria-controls:'panel-' + item.id, aria-selected:selected === item.id ? 'true' : 'false', aria-disabled:item.disabled ? 'true' : 'false', tabindex:selected === item.id ? 0 : -1, data-state:selected === item.id ? 'active' : 'inactive'"
                 data-text="item.label"></button>
       </template>
     </div>

     <template data-each="tabs" data-key="id">
       <div class="micra-tabs__panel" role="tabpanel" tabindex="0"
            data-show="selected === item.id"
            data-bind="id:'panel-' + item.id, aria-labelledby:'tab-' + item.id"
            data-text="item.body"></div>
     </template>
   </micra-tabs>
   ```

3. Call `Micra.start()` once, after your components are defined.

To supply your own tabs, edit the `state.tabs` array in `define.js` (replace the
array — never mutate it in place). Multiple tab groups on one page work out of
the box — each `<micra-tabs>` is an independent instance.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `tabs.css`. It is yours.
- **Tailwind (optional)** — the active tab lives in `data-state`, so you can skip
  `tabs.css` and style with native variants instead:
  `class="… data-[state=active]:border-current"`.

## Accessibility

`role="tablist"` wraps the `role="tab"` buttons; each panel is `role="tabpanel"`
labelled by its tab (`aria-labelledby`), and each tab points at its panel
(`aria-controls`). Only the selected tab is in the tab order (roving tabindex);
arrow keys move between enabled tabs and wrap, Home / End jump to the first / last
enabled tab. Activation is automatic — changing the selection moves real focus to
the newly selected tab. Disabled tabs are skipped by both pointer and keyboard.

## License

MIT — see `LICENSE` in the repo root.
