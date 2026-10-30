# Dropdown

Accessible menu button: click or arrow keys to open, keyboard navigation with a
roving `aria-activedescendant` (real focus never leaves the menu), wrap-around
arrows that skip disabled items, Home/End jumps, Enter/Space to select, Escape to
close, outside-click to close, focus return to the trigger. Headless behavior in
`define.js`; the look is a default skin in `dropdown.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="dropdown.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Items come from `state.items` (`{ id, label, disabled? }`),
   rendered with `<template data-each>`:

   ```html
   <micra-dropdown class="micra-dropdown" @pointerdown.outside="close">
     <button class="micra-dropdown__trigger" data-ref="trigger"
             aria-haspopup="menu" aria-controls="dropdown-menu"
             data-bind="aria-expanded:isOpen ? 'true' : 'false'"
             @click="toggle"
             @keydown.down.prevent="open"
             @keydown.up.prevent="open">
       Options
     </button>

     <ul class="micra-dropdown__menu" id="dropdown-menu" role="menu"
         data-ref="menu" tabindex="-1"
         data-bind="data-state:isOpen ? 'open' : 'closed',
                    aria-activedescendant:activeDescendant()"
         @keydown.down.prevent="moveDown"
         @keydown.up.prevent="moveUp"
         @keydown.home.prevent="moveFirst"
         @keydown.end.prevent="moveLast"
         @keydown.enter.prevent="activate"
         @keydown.space.prevent="activate"
         @keydown.escape="close">
       <template data-each="items" data-key="id">
         <li class="micra-dropdown__item" role="menuitem"
             data-bind="id:item.id,
                        aria-disabled:item.disabled ? 'true' : 'false',
                        data-state:isActive(item.id) ? 'active' : ''"
             @click="select(item.id)"
             data-text="item.label"></li>
       </template>
     </ul>
   </micra-dropdown>
   ```

3. Seed the items and call `Micra.start()` once, after your components are
   defined. Listen for `select` to react to a choice:

   ```html
   <script>
     Micra.start();
     const el = document.querySelector('[data-component="dropdown"]');
     const menu = Micra.instances().get(el);
     menu.state.items = [
       { id: 'new', label: 'New file' },
       { id: 'open', label: 'Open…' },
       { id: 'rename', label: 'Rename' },
       { id: 'archive', label: 'Archive', disabled: true },
       { id: 'delete', label: 'Delete' },
     ];
     menu.on('select', (item) => console.log('chose', item.id));
   </script>
   ```

Multiple dropdowns on one page work out of the box — each `<micra-dropdown>`
is an independent instance with its own state. Give each menu a unique `id` /
`aria-controls` pair.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `dropdown.css`. It is yours.
- **Tailwind (optional)** — the state lives in `data-state`, so you can skip
  `dropdown.css` and style with native variants instead:
  `class="… data-[state=open]:opacity-100 data-[state=active]:bg-indigo-600"`.

## Accessibility

The trigger carries `aria-haspopup="menu"`, `aria-expanded` (bound to the open
state), and `aria-controls` pointing at the menu. The menu is `role="menu"` and
holds focus itself; the active item is tracked with `aria-activedescendant`
rather than moving DOM focus, so screen readers announce the highlighted item
while focus stays on the container. Items are `role="menuitem"` with
`aria-disabled` bound for disabled entries (which navigation and selection skip).
Arrow keys wrap, Home/End jump to the first/last enabled item, Enter/Space
select, Escape closes and returns focus to the trigger. Motion respects
`prefers-reduced-motion` (tokens zero the duration). The menu is non-interactive
when closed (`visibility: hidden`).

## License

MIT — see `LICENSE` in the repo root.
