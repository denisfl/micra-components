# Data Table

Production data table: client- or server-side data, multi-column sort, global
search, row selection with a tri-state header, bulk actions, CSV/JSON export, a
sticky header, and a numbered pager — all keyboard- and ARIA-aware. Headless
behavior in `define.js`; the look is a default skin in `datatable.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="datatable.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup (the full table is in `index.html` — copy it). Feed columns
   and rows after `Micra.start()`. Columns set in JS can carry a real formatter
   function; the `align: 'right'` column is right-aligned:

   ```js
   Micra.start();

   const root = document.querySelector('[data-component="datatable"]');
   const table = Micra.instances().get(root); // live instance, keyed by root el
   table.state.columns = [
     { key: 'id',     label: 'ID',     sortable: true, width: '5rem' },
     { key: 'name',   label: 'Name',   sortable: true },
     { key: 'amount', label: 'Amount', sortable: true, align: 'right', format: 'currency' },
     { key: 'date',   label: 'Date',   sortable: true, format: 'date' },
   ];
   table.state.rows = orders; // the full dataset in client mode
   table.on('bulk', ({ action, ids }) => { /* delete / archive / … */ });
   ```

   You can also seed simple data declaratively with `data-columns` and `data-rows`
   JSON attributes (columns then carry a string `format` name, e.g. `"currency"`,
   not a function), plus `data-page-size` and `data-row-key`.

3. Call `Micra.start()` once, after your components are defined.

### Columns

`{ key, label, sortable?, align?, width?, format? }`. `align` is `'left'`
(default), `'right'`, or `'center'`. `format` is optional — a function
`(value, row) => string`, or a named string resolved by the built-in formatters
map (`'currency'`, `'number'`, `'date'`). JSON-seeded columns use the string form;
JS-seeded columns can use either.

### Client vs server mode

- **Client (default).** `state.rows` holds the full dataset. The table filters,
  sorts, and paginates in the browser. Nothing else to wire.
- **Server.** Add `data-server` to the root. On every sort / search / page /
  page-size change the table calls out:
  - with `data-url="/api/x"`, it fetches `?sort=&search=&page=&pageSize=` and
    expects `{ rows, total }` back;
  - without a URL, it emits a `query` event `{ sort, search, page, pageSize }` and
    you answer by calling `table.setData(rows, total)`.

  In server mode `state.rows` holds only the current page and `state.total` the
  full count; filtering/sorting/paging are the backend's job. The component still
  owns selection, the tri-state header, export, and the UI. See the commented
  block at the bottom of `index.html` for both wiring styles.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

  The selected-row tint, the sort indicators, the selection check, the current
  page, and the focus ring all follow `--micra-primary` / `--micra-ring`. The
  selected-row tint is a `color-mix` of `--micra-primary`, so it tracks the accent
  with no hardcoded hue.

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `datatable.css`. It is yours. The selection check and
  the indeterminate dash are CSS shapes drawn from tokens, not images.
- **Tailwind (optional)** — state lives in `data-state`, `aria-sort`,
  `aria-checked`, and `aria-current`, so you can skip `datatable.css` and style
  with native variants:
  `class="… aria-[sort=ascending]:text-indigo-600 data-[state=selected]:bg-indigo-50"`.

## Accessibility

A real `<table>` with `scope="col"` headers. Sortable headers are `<button>`s and
carry `aria-sort` on the cell as the string `"ascending"` / `"descending"` /
`"none"`. The selection column is a `role="checkbox"` per row plus a tri-state
header checkbox whose `aria-checked` is the string `"true"` / `"false"` /
`"mixed"`; Space toggles the focused box (Enter too, since each is a `<button>`).
Selected rows set `aria-selected="true"`. The pager's prev/next use the real
`disabled` attribute at the bounds (plus `aria-disabled`), and the current page is
`aria-current="page"`. The table sets `aria-busy` while a server request is in
flight, and a polite `aria-live` region announces the visible range, loading, and
selection count. Focus rings are visible via `--micra-ring`; motion respects
`prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
