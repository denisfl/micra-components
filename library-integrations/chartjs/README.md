# Chart.js — charting integration

A thin reactive wrapper around [Chart.js 4](https://www.chartjs.org) (MIT). Chart.js
owns the canvas rendering; Micra mirrors its interactions into state and — because
Chart.js paints to a canvas and has **no theme awareness** — feeds it your theme.
The wrapper reads your `--micra-*` tokens at runtime and applies them to the chart,
so it follows light / dark like the rest of your UI.

Open `index.html` to see it running (light + dark, zoom, line/bar, scatter).

We sell the **glue** — reactive binding, the token-driven theming, clean teardown —
not a fork of Chart.js. Chart.js loads from a CDN and stays Chart.js.

## When to use this vs native Micra Charts

Micra's native SVG Charts (v2) cover roughly **90%** of dashboard work, and you
should prefer them when they fit — no extra dependency, smaller, and they theme
through tokens directly:

- stacked bars / areas
- legend click-to-toggle
- crosshair / shared tooltip
- mixed and dual-axis charts

This Chart.js integration is the **escape hatch** for the rest — the things native
deliberately does not do:

- a real **time x-axis** (Date values, automatic tick units), via the date-fns adapter
- **zoom and pan** (drag-to-zoom, wheel, drag-to-pan)
- **scatter / bubble** plots
- a **canvas** that stays smooth with tens of thousands of points

Native does not do these; don't expect it to. Reach for Chart.js when you need one
of the four above, and stay on native otherwise.

## Use it

1. Load Chart.js, then the time adapter (self-registers) and the zoom plugin
   (you register it), then Micra and the wrapper, then this skin. **Order matters:**
   the `Chart` global and the zoom plugin must exist before `Micra.start()` builds
   the chart in `onCreate`.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="chartjs.css" />

   <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2/dist/chartjs-plugin-zoom.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script>
     // Register the zoom plugin (the date-fns adapter self-registers).
     Chart.register(window.ChartZoom || window['chartjs-plugin-zoom']);
   </script>
   <script src="define.js"></script>
   ```

2. Drop in the markup — a sized, `position: relative` container (the `.micra-chart`
   class) around the `<canvas>`, plus any UI bound to the wrapper's reactive state:

   ```html
   <micra-chartjs data-kind="line" class="micra-chartcard">
     <button @click="resetZoom" data-bind="disabled:!isZoomed()">Reset zoom</button>

     <div class="micra-chart">
       <canvas data-ref="canvas" role="img" aria-label="Sessions over time"></canvas>
     </div>

     <span data-text="pointCount() + ' points'"></span>
     <span data-text="isZoomed() ? 'Zoomed in' : 'Full range'"></span>
   </micra-chartjs>
   ```

3. Provide the data. The wrapper calls `window.chartjsSeries(rootEl)` in `onCreate`
   and expects `{ time: [{x, y}, …], scatter: [{x, y}, …] }`, where `x` is a `Date`
   or epoch ms. Swap this hook for your own data source (a `fetch`, a server-rendered
   `<script type="application/json">`, etc.) — one component, any data.

4. Call `Micra.start()` once, after the scripts above.

## What you get

The wrapper exposes:

- `applyTheme()` — re-reads every `--micra-*` token and pushes the colors into the
  live chart, then `chart.update()`. **Call this from your theme toggle** — it is the
  dark-mode support, since Chart.js has none of its own. Recoloring is done in place,
  so zoom/pan state survives.
- `state.kind` (`'line'` / `'bar'`), `setKind()` / `toggleLine()` / `toggleBar()` —
  switch the primary dataset's render type; the chart updates imperatively while the
  Micra UI reacts to the state change.
- `toggleScatter()` — show / hide the scatter (anomaly) dataset.
- `isZoomed()` / `resetZoom()` — `isZoomed()` reflects the zoom plugin's state (driven
  by its `onZoomComplete` / `onPanComplete` callbacks) so you can disable a "Reset zoom"
  button; `resetZoom()` calls the plugin's `chart.resetZoom()`.
- `pointCount()` / `kindLabel()` — derived readouts for the UI.

## Theming

Chart.js renders to a `<canvas>`, so its colors **cannot** be set in CSS — they live
in JS. The integration's value is bridging that: `define.js` reads tokens with
`getComputedStyle(document.documentElement).getPropertyValue('--micra-…')` and maps
them onto the config — grid lines from `--micra-border`, tick/legend text from
`--micra-muted` / `--micra-fg`, datasets from `--micra-primary` / `--micra-success` /
`--micra-warning`.

- **Recolor** by overriding tokens (`:root { --micra-primary: #16a34a }`) — no edits
  to the wrapper. The next `applyTheme()` picks them up.
- **Dark mode** works because `applyTheme()` re-reads the tokens after you flip
  `data-theme="dark"` on `<html>`. Wire it into your toggle:

  ```js
  document.documentElement.dataset.theme = 'dark';
  Micra.instances().get(root).applyTheme();
  ```

- `chartjs.css` only styles the **card** around the canvas (border, radius, padding,
  the sized `position: relative` container Chart.js needs). It references only tokens.
  You own it.

## Cleanup — important

Chart.js **leaks** if you don't destroy it: it keeps the canvas, its `ResizeObserver`,
and animation handles alive. The wrapper calls `chart.destroy()` in `onDestroy`, so
under `Micra.autoCleanup()` (htmx / Astro island swaps) detached canvases don't pile
up. If you build a chart by hand outside this wrapper, destroy it yourself.

## Accessibility

A `<canvas>` is opaque to assistive tech. Give it `role="img"` and a meaningful
`aria-label` summarising the chart, and — for anything load-bearing — pair it with an
accessible data table or text summary. Zoom/pan are mouse / touch gestures; provide
the "Reset zoom" button (and ideally keyboard alternatives) for non-pointer users.

## License

Chart.js, `chartjs-adapter-date-fns`, and `chartjs-plugin-zoom` are **MIT**. This
wrapper and skin are MIT too — see `LICENSE` in the repo root.
