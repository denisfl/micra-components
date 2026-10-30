# Charts

Bar, line, pie/donut, and **mixed** charts. Bar and line render a numeric value (Y)
axis with gridlines and support **one or more series** — grouped or **stacked** bars,
multiple or **stacked-area** lines; **mixed** combines bars and lines in one plot
with an optional **second (right) Y axis**; pie renders a single series as slices. The **legend is
interactive**: click an entry to hide/show a series (or pie slice), and the value
axis rescales to what's left. Bar and line also get an **interactive crosshair
tooltip** that follows the pointer and shows every visible series at the nearest
category. Responsive SVG that scales to its container, a token-driven palette, an
accessible `role="img"` summary, and a screen-reader data list. Headless behavior in `define.js`; the look is a default
skin in `charts.css` driven by `theme/theme.css` tokens.

The chart SVG is built as a string in a method (`svg()`) and rendered with
`data-html`, so it recomputes reactively when the type or data changes — no
per-node SVG binding. The legend is plain HTML outside the SVG.

Open `index.html` to see all three running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="charts.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Set the type with `data-type` (`bar` | `line` | `pie` | `mixed`) and
   seed the data with a `data-data` JSON attribute (`[{ "label", "value" }, …]`).
   The `data-html="svg()"` wrapper is `role="img"` and gets its label from
   `ariaSummary()`; the legend and the visually-hidden data list follow:

   ```html
   <micra-charts class="micra-charts" data-type="bar"
        data-data='[{"label":"Jan","value":12400},{"label":"Feb","value":18900}]'>
     <div class="micra-charts__plot" role="img"
          data-bind="aria-label:ariaSummary(), data-state:plotState()"
          data-html="svg()"></div>

     <ul class="micra-charts__legend">
       <template data-each="legend()" data-key="key">
         <li>
           <span class="micra-charts__swatch" data-bind="style:swatchStyle(item.color)"></span>
           <span data-text="item.label"></span>
           <span class="micra-charts__legend-value" data-text="item.value"></span>
         </li>
       </template>
     </ul>

     <ul class="micra-charts__sr">
       <template data-each="dataList()" data-key="key">
         <li><span data-text="item.label"></span>: <span data-text="item.value"></span></li>
       </template>
     </ul>
   </micra-charts>
   ```

3. Call `Micra.start()` once, after your components are defined.

**Driving it from JS.** Reach a live instance via `Micra.instances().get(el)` (a
read-only Map keyed by the root element) and use the public API:

```js
const chart = Micra.instances().get(document.querySelector('[data-component="charts"]'));
chart.setData([{ label: 'Q1', value: 40 }, { label: 'Q2', value: 65 }]); // replace the series
chart.setType('line');   // 'bar' | 'line' | 'pie' | 'mixed'
chart.setStacked(true);  // stack bars / areas (bar & line only)
chart.toggle(0);         // hide/show series (bar/line) or slice (pie) by index
```

Both replace state and re-render; `setData` also reads as the initial seed from
`data-data`. Multiple charts on one page each run as an independent instance.

**Donut.** Add `data-hole="0.6"` (0–0.9) to a pie to cut an inner radius.

**Stacked.** Add `data-stacked="true"` to a bar or line chart to stack the series
(stacked columns / stacked areas) instead of grouping them. Toggle at runtime with
`setStacked(true|false)`. Stacking uses positive values; the value axis scales to
the tallest column sum.

**Mixed / dual axis.** Set `data-type="mixed"` and give each series a `kind`
(`"bar"` | `"line"`, default `bar`) and an `axis` (`"left"` | `"right"`, default
`left`). Bar-kind series group side by side; line-kind draw over them. A right axis
gets its own scale and labels, drawn only when a series is assigned to it — the
classic revenue-bars + margin-%-line combo:

```js
{ categories: ['Jan', 'Feb', 'Mar'], series: [
    { name: 'Revenue',  kind: 'bar',  axis: 'left',  data: [12400, 18900, 15200] },
    { name: 'Margin %', kind: 'line', axis: 'right', data: [18, 22, 19] },
] }
```

**Interactive legend.** For multi-series bar/line and for pie, the legend entries
are clickable — clicking hides or shows that series (or slice) and the chart
rescales, like a typical dashboard. The component keeps at least one visible. The
legend markup wires it with `@click="toggle(item.index)"` and reflects state with
`data-bind="data-hidden:item.hidden ? 'true' : 'false'"` (single-series legends are
per-point and not toggleable). Hiding is a visual interaction only — the
screen-reader data list and `aria-label` still describe the full dataset.

**Tooltip.** Bar and line charts show a crosshair + value box on hover, built as a
self-contained HTML overlay (the component creates it — no extra markup needed) so
it stays crisp at any size and themes from the same tokens. It reads the nearest
category and lists every visible series. Pie keeps native per-slice titles.

**Data shapes.** Three accepted forms, all normalized internally:

```js
// 1. single series (label/value)
[{ label: 'Jan', value: 12400 }, …]
// 2. multi-column (one row per category, a value per series)
[{ label: 'Jan', values: [9800, 12400] }, …]
// 3. explicit multi-series (recommended for multiple series)
{ categories: ['Jan', 'Feb'], series: [
    { name: '2025', data: [9800, 12400] },
    { name: '2026', data: [12400, 18900] },
] }
```

Bar groups one bar per series at each category; line draws one polyline per series;
**pie uses the first series**. The legend is per-series when there are multiple,
per-point for a single series. Values are coerced to numbers (non-numeric → `0`);
the value axis scales to a "nice" rounded maximum with gridline ticks; numbers are
formatted compactly (`k`/`M`). Deferred by design — these are where the planned
Chart.js integration takes over, so the native component stays small: a
continuous/time (X) scale, scatter/bubble, zoom & pan, and canvas rendering for very
large datasets.

## Theming

- **Recolor the palette** — the series colors are local tokens that default to the
  theme accents. Override `--micra-chart-1..4` (on `.micra-charts` or `:root`):

  ```css
  :root {
    --micra-chart-1: #2563eb;
    --micra-chart-2: #16a34a;
    --micra-chart-3: #d97706;
    --micra-chart-4: #db2777;
  }
  ```

  Bar and line use `--micra-chart-1` (the primary). Pie cycles all four; beyond
  four slices it `color-mix`es steps of `--micra-primary`, so any slice count
  stays on-palette. Recoloring `--micra-primary` alone moves bars, line, and the
  first slice together.

- **Reshape / restyle** without touching this component — override the shared
  tokens (`--micra-surface`, `--micra-border`, `--micra-radius`, `--micra-fg`,
  `--micra-muted`). The plot frame, axis, and labels follow.
- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`). The
  palette and surfaces swap with the tokens.
- **Full control** — edit `charts.css`. It is yours.

## Accessibility

The plot wrapper is `role="img"` with an `aria-label` from `ariaSummary()` — the
chart kind plus every `label: value` pair read out (e.g. *"Bar chart: Jan 12,400,
Feb 18,900, …"*). A visually-hidden (`sr-only`) list of the same `label: value`
pairs follows the SVG, so assistive tech that prefers structured data gets it too.
Each shape carries a native `<title>` for a browser tooltip on hover. The SVG
itself is `role="presentation"` so it is not announced twice over the wrapper.

Motion — bars grow, the line draws in, slices and labels fade up — is gated behind
`@media (prefers-reduced-motion: no-preference)` and driven by `--micra-duration`,
so it stops cleanly when the user asks to reduce motion.

## License

MIT — see `LICENSE` in the repo root.
