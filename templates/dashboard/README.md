# Micra Dashboard — template

A SaaS analytics dashboard assembled from Micra components, under the same
shell (sidebar + topbar + ⌘K palette) as the Admin template. One HTML file plus one
stylesheet, no build step, driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark, desktop + mobile).

## What's in it

Two screens, switched from the sidebar (and the ⌘K palette).

**Overview** — the dashboard itself:
- **KPI row** — four metric cards: value + delta (coloured by whether the trend is
  good, so a falling churn rate reads green).
- **Revenue & signups** — the **Charts** component in **mixed / dual-axis** mode:
  signups as bars (left axis), MRR as a line (right axis), with a 7d / 30d / 12m
  segmented control, legend toggle, and crosshair tooltip.
- **Plan mix** — a **Charts** pie with a clickable legend.
- **Signups by channel** — a **Charts** stacked bar.
- **Recent activity** — a lightweight event feed (initials + text + time + kind).
- **Latest transactions** — a compact **Data Table** (sort, pagination).

**Settings** — a tabbed flat form (Profile / Notifications / Billing) with two-way
binding and toggles.

Plus the shared shell: ⌘K **Command Palette**, theme toggle, responsive sidebar.

## Run it

Open `templates/dashboard/index.html` directly, or serve the repo root with any
static server and visit `/templates/dashboard/` (keep the trailing slash). Micra
and Lucide load from the CDN; the component behaviors load from `../../components/`.

## How it's built

- `index.html` — the markup plus a short inline script that defines the `dashboard`
  shell, seeds demo data, and switches the hero chart's period.
- `dashboard.css` — the layout. Token-driven, no Tailwind; the sidebar width is one
  variable (`--dash-sidebar`), panels and rows are a simple CSS grid.
- The shipped components — **Charts**, **Data Table**, **Command Palette** — load
  from `components/<name>/`. Tokens come from `theme/theme.css`.

## Wire it to your data

Every widget reads plain data you provide. Three seams:

**1. Charts.** Each chart is a `[data-component="charts"]` instance. Two ways to
feed it: a `data-data` JSON attribute on the markup (used here for the initial
render), or the public API on the live instance —

```js
const hero = Micra.instances().get(document.getElementById("hero-chart"));
hero.setData({
  categories: [...],
  series: [
    { name: "Signups", kind: "bar",  axis: "left",  data: [...] },
    { name: "MRR ($k)", kind: "line", axis: "right", data: [...] },
  ],
});
```

The period switch (`setPeriod`) already calls `setData` with a different dataset —
point those at your `/api/metrics?range=…` responses.

**2. KPI cards and the activity feed** are seeded from `state.kpis` and
`state.activity` on the dashboard component. Replace those arrays with your
numbers; both render through `data-each`, so the view updates when the state does.

**3. The transactions table** seeds from JS like any Data Table:

```js
const tx = Micra.instances().get(document.getElementById("tx-table"));
tx.state.columns = TX_COLUMNS;
tx.state.rows = TRANSACTIONS; // ← your rows
```

For server-side paging/sorting, switch it to server mode (`data-server data-url`);
see `components/datatable/README.md`.

### Any back end

The seams above are plain JSON — Rails, Laravel, Django, WordPress, or anything
else can serve them. A metrics endpoint returns the chart series and KPI numbers; a
transactions endpoint returns the table rows. Micra holds none of it server-side.

## Theming

- **Recolor / reshape** by overriding tokens — no component edits:

  ```css
  :root { --micra-primary: #0ea5e9; --micra-radius: 6px; }
  ```

  The charts derive their series palette from the tokens too, so one override
  re-skins every chart.
- **Dark mode** — the topbar toggle sets `data-theme` on `<html>`; the OS
  preference applies by default unless `data-theme="light"` is set.
- **Sidebar width** — `.dash { --dash-sidebar: 18rem; }`.
- **Full control** — `dashboard.css` is plain CSS. It's yours; edit it.

## Accessibility

Each chart is `role="img"` with an `aria-label` summary plus a visually-hidden data
list, so the numbers are available without sight of the SVG. The Command Palette is
`role="dialog"` + `aria-modal` with a focus trap and Escape; the Data Table has
sortable header buttons and a live region. Motion respects
`prefers-reduced-motion` (the duration token zeroes out).

## License

MIT — see `LICENSE` in the repo root.
