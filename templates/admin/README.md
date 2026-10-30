# Micra Admin — template

A finished admin app assembled from Micra components: a users table, a
customers grid, a settings screen, an add-user drawer, and a ⌘K command palette —
wired together over Micra's event bus. One HTML file plus one stylesheet, no build
step, driven entirely by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark, desktop + mobile).

## What's in it

- **Users** — the **Data Table** component: sort, search, pagination, row
  selection, CSV / JSON export, and bulk delete. Click a row to edit it; "Add user"
  opens the same drawer blank.
- **Customers** — a card grid (plain Micra `data-each`). Click a card to edit;
  "Add customer" opens its **Slide-over** blank.
- **Settings** — a tabbed flat form (Profile / Notifications / Security) with
  two-way `data-model` binding; editing the profile name updates the sidebar live.
- **Add user** — the **Slide-over** component wrapping a small validated form.
- **Command palette** — the **Command Palette** component: ⌘/Ctrl + K, fuzzy
  search, grouped commands that jump between views or fire actions.
- A light/dark toggle and a responsive off-canvas sidebar.

## Run it

Open `templates/admin/index.html` directly, or serve the repo root with any static
server and visit `/templates/admin/` (keep the trailing slash if your server does
clean-URL redirects — the relative paths depend on it). Micra and Lucide load from
the CDN; the component behaviors load from `../../components/`.

## How it's built

- `index.html` — the markup plus a short inline script that defines the `admin`
  shell and the template-local `userform`, then seeds the demo data.
- `admin.css` — the layout. Token-driven, no Tailwind; the sidebar width is one
  variable (`--admin-sidebar`).
- The shipped components it pulls in — **Data Table**, **Slide-over**, **Command
  Palette** — each as its own `components/<name>/define.js` + `.css`. Tokens come
  from `theme/theme.css`.

The pieces talk over Micra's **event bus**, never reaching into each other's
state. The command palette emits `run`; the add-user form emits `user:save` and
`editor:close`; the `admin` shell listens and routes — switching the view, opening
the drawer, or appending a row. That seam is what lets you swap any one piece.

## Wire it to your data

Two seams turn the demo into a real app.

**1. The users table** is seeded from a JS array:

```js
const table = Micra.instances().get(document.querySelector('[data-component="datatable"]'));
table.state.columns = columns;
table.state.rows = users; // ← your rows
```

For server-side paging / sorting / search, switch the table to server mode (see
`components/datatable/README.md`): add `data-server data-url="/api/users"` to the
table root, and have the endpoint read `?sort=&search=&page=&pageSize=` and return
`{ rows, total }`.

**2. Saving a user.** The drawer's form emits `user:save` for both add and edit —
the payload carries an `id` when editing, so the shell's `_upsert` replaces in
place or prepends a new row. Opening the drawer pre-filled is just
`emit("user:edit", row)`; row-click does that. Replace the save handler with a
request to persist:

```js
this.on("user:save", async (u) => {
  const saved = await this.fetch(u.id ? `/api/users/${u.id}` : "/api/users", {
    method: u.id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(u),
  });
  this._table().state.rows = this._upsert(this._table().state.rows, saved);
});
```

Customers are the same wiring on a different event: the drawer emits
`customer:save` (add and edit), and the shell upserts into `state.customers` —
swap that for your POST/PUT too. Settings is the same shape again: your values live
in `state.settings`, and `save()` is where you'd POST them.

**Bulk delete.** The table's selection bar emits `bulk` with `{ action, ids }`; the
shell removes those rows from `state.rows` and clears the selection. In production
that handler is where you'd `DELETE` on the server (and confirm first).

### Any back end

Micra doesn't care what renders the page or serves the JSON — the seams above are
plain endpoints, so any stack fits:

- **Rails** — a `UsersController` returning JSON for `index`/`create` (or the
  `micra-rails` gem to render Micra islands from views).
- **Laravel** — an API resource controller: `GET /api/users`, `POST /api/users`.
- **Django** — a DRF viewset, or a plain `JsonResponse`.
- **WordPress** — a REST route via `register_rest_route` returning the rows.

## Theming

- **Recolor / reshape** by overriding tokens — no component edits:

  ```css
  :root { --micra-primary: #0ea5e9; --micra-radius: 6px; }
  ```

- **Dark mode** — the topbar toggle sets `data-theme` on `<html>`; the OS
  preference applies by default unless `data-theme="light"` is set.
- **Sidebar width** — `.admin { --admin-sidebar: 18rem; }`.
- **Icons** are Lucide via CDN — swap or self-host freely.
- **Full control** — `admin.css` is plain CSS. It's yours; edit it.

## Accessibility

Inherited from the components: the Data Table has sortable header buttons, a
tri-state select-all, and a polite live region; the Slide-over and Command Palette
are `role="dialog"` + `aria-modal`, with a focus trap, focus return to the trigger,
Escape to close, and body scroll lock. Nav items, toggles, and icon buttons are
real, labelled controls. Motion respects `prefers-reduced-motion` (the duration
token zeroes out), so everything still works without animation.

## License

MIT — see `LICENSE` in the repo root.
