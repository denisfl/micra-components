# Kanban

A drag-and-drop board with money in it: columns of cards, per-column totals, WIP
limits, and a board forecast. Cards move by pointer (HTML5 drag-and-drop) **or** by
keyboard — focus a card and use the arrow keys, or the on-card move buttons — so
the board is never mouse-only. Every move rebuilds the board immutably and emits a
`move` event; screen readers hear an announcement. Headless behavior in
`define.js`; the look is a default skin in `kanban.css` driven by `theme/theme.css`
tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="kanban.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Seed the board with a `data-columns` JSON attribute (or call
   `setColumns([...])` on the instance). A column may declare a `wip` limit; a card
   may carry a `value` and `meta`:

   ```html
   <micra-kanban
     class="micra-kanban"
     data-columns='[
       {"id":"lead","title":"Lead","cards":[
         {"id":"d1","title":"Northwind Traders","value":12000,"meta":"Inbound"}
       ]},
       {"id":"proposal","title":"Proposal","wip":2,"cards":[
         {"id":"d2","title":"Stark Industries","value":48000}
       ]}
     ]'
   >
     <!-- See index.html for the full board markup: the forecast summary, the
          column row (columnsView()), the nested card loop with @dragstart /
          @dragover / @drop and the keyboard move controls, and the aria-live
          region. -->
   </micra-kanban>
   ```

3. Call `Micra.start()` once, after your components are defined.

4. Listen for moves — the component owns the board; you decide what a move *means*
   (persist it, notify someone, …):

   ```js
   const board = Micra.instances().get(
     document.querySelector('[data-component="kanban"]')
   );
   board.on('move', ({ cardId, from, to, index }) => {
     // from / to are column ids; index is the card's final position in `to`.
     saveCardPosition(cardId, to, index);
   });
   ```

The state is the single source of truth. The DOM is read only for geometry (which
card rectangle the pointer is over) to pick a drop index — never to hold data.
Multiple boards on one page work out of the box; each `<micra-kanban>` is
its own instance.

### Data shape

```js
state.columns = [
  {
    id: 'proposal',
    title: 'Proposal',
    wip: 2,                       // optional WIP limit
    cards: [
      { id: 'd7', title: 'Stark Industries', value: 48000, meta: 'Pricing' },
    ],
  },
];
```

`columnTotal(id)` sums a column's card values; `forecast()` sums across the board.
Both ignore missing values. A weighted pipeline forecast (multiply each column's
total by a win probability) is a host concern — `forecast()` is the straight sum.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

  The drop-target highlight, the accent bar, and the focus rings all follow.
- **Over-WIP** columns flag with `--micra-warning`; recolor that token to change
  the flag everywhere.
- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `kanban.css`. It is yours. The horizontal board scroll,
  the column surfaces, the card tiles, and the drop placeholder are all plain CSS.
- **Tailwind (optional)** — drag and WIP state live in `data-state`, so you can
  skip `kanban.css` and style with native variants instead:
  `class="… data-[state=over]:ring-2"`.

## Accessibility

The board is a labelled `role="list"`; each column is a labelled `role="listitem"`
(`aria-label="<title> (<n>)"`); each card is focusable with an accessible name.
Drag-and-drop is **not** mouse-only — every card takes keyboard focus and moves
with the arrow keys (left/right change column, up/down reorder), and each card also
carries four labelled move buttons doing the same thing. Both paths call the same
immutable `moveCard()`, so a keyboard user and a mouse user get identical results.
After a keyboard move, focus follows the card to its new position. Each move is
announced through an `aria-live="polite"` region ("Moved Stark Industries to Won,
position 1."). Motion respects `prefers-reduced-motion` (the tokens zero the
duration).

## License

MIT — see `LICENSE` in the repo root.
