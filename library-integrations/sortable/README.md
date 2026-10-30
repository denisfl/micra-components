# SortableJS — drag-to-reorder integration

A thin reactive wrapper around [SortableJS](https://sortablejs.github.io/Sortable/)
(MIT, the plain-JS drag-and-drop library). SortableJS owns the dragging; Micra owns
the **order**. The list renders from `state.items` via `<template data-each>`, so
state is the single source of truth — the rank numbers, a live order readout, and a
saved / unsaved flag all react with no extra code, and a token skin makes the rows
and drag states match your theme (light + dark).

Open `index.html` to see it running.

We sell the **glue** — the state-sync discipline (below), the token skin, clean
teardown — not a fork of SortableJS. It loads from a CDN and stays SortableJS.

## Use it

1. Load the tokens and this skin, then SortableJS, Micra, and the wrapper. **Order
   matters:** SortableJS must load before `Micra.start()`.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="sortable.css" />

   <script src="https://cdn.jsdelivr.net/npm/sortablejs@1/Sortable.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup — a list rendered from state, with a drag handle on each row:

   ```html
   <micra-sortable>
     <ul class="micra-sortable" data-ref="list">
       <template data-each="items" data-key="id">
         <li class="micra-sortable__row">
           <span class="micra-sortable__rank" data-text="$index + 1"></span>
           <span class="micra-sortable__label" data-text="item.label"></span>
           <span class="micra-sortable__handle" data-sortable-handle>⠿</span>
         </li>
       </template>
     </ul>

     <span data-text="isDirty() ? 'Unsaved order' : 'Saved'"></span>
     <button @click="save" data-bind="disabled:!isDirty()">Save order</button>
     <div data-text="orderLabel()"></div> <!-- live order, from state -->
   </micra-sortable>
   ```

3. Call `Micra.start()` once, after the scripts above.

**Seeding the list.** Either set `state.items` before `Micra.start()` (how a server
renders an existing list), or put a JSON array on `data-seed` on the root and the
wrapper loads it once. Each item needs an `id` (the `data-key`) and whatever fields
your rows bind.

## How the order stays in sync (the value)

Two things want to move the same `<li>`: SortableJS physically moves the dragged node
in the DOM, and Micra renders the list from `state.items`. Letting both win causes a
desync (double-move / flicker). The wrapper resolves it in `onEnd`:

1. **Undo SortableJS's DOM change first** — put the dragged node back at its original
   index (`evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex])`). Now the
   DOM matches what Micra last rendered, so Micra's keyed reconciler has a valid
   baseline.
2. **Then write the reordered `state.items`** (a new array — never mutate the proxy in
   place). Writing state schedules the keyed re-render, and **Micra alone** moves the
   keyed rows to match.

So `state.items` is the one source of truth. The visible rank (`$index + 1`) and the
`orderLabel()` readout are derived from it, which is why they update the instant the
state changes — not because the DOM moved.

## What you get

The wrapper exposes:

- `state.items` — the ordered list. Render rows from it; read it on save.
- `order()` — the current order as ids; `orderLabel()` — a human-readable line.
- `isDirty()` — true when the order differs from the last save; drives an "Unsaved"
  indicator and a disabled Save button.
- `save()` — snapshots the current order as saved and emits a `save` event with the
  ordered ids (where you'd `PUT` it). `reset()` restores the saved order.
- Events: `reorder` (ordered ids, on every drop) and `save`.

## Theming

The skin references only `--micra-*` tokens, so it follows your theme. It styles the
rows plus the three states SortableJS toggles classes for:

- `.sortable-ghost` — the drop-placeholder slot (dashed `--micra-primary`, faded).
- `.sortable-chosen` — the lifted item (token ring + shadow).
- `.sortable-drag` — the clone following the cursor.

Recolor by overriding tokens — no edits here:

```css
:root { --micra-primary: #16a34a; --micra-radius: 6px; }
```

**Dark mode** works — every value is a token. Set `data-theme="dark"` on `<html>`.
The grip uses `grab` / `grabbing` cursors. `sortable.css` is yours; edit it.

## Notes & limits

- **Drag handle.** The wrapper sets SortableJS's `handle: '[data-sortable-handle]'`,
  so only the grip starts a drag and row text stays selectable. Remove that option in
  `define.js` to drag the whole row.
- **Dragging between lists** (shared `group`) is not included — it needs the same
  undo-then-write discipline applied across two state arrays (`evt.from` / `evt.to`)
  and is left out to keep one clean source of truth per list.
- Clean teardown: `onCreate` creates the Sortable, `onDestroy` calls `.destroy()`, so
  it's safe under `Micra.autoCleanup()` when htmx or Astro swaps the island out.

## License

SortableJS is **MIT**. This wrapper and skin are MIT too — see `LICENSE` in the repo root.
