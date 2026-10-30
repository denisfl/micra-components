/*
 * library-integrations/chartjs/define.js — Chart.js × Micra.
 *
 * A thin reactive wrapper around Chart.js 4 (MIT). Chart.js owns the canvas
 * rendering; Micra owns the reactive glue and — because Chart.js paints to a
 * canvas and has NO theme awareness — the theming. The wrapper reads your
 * --micra-* tokens at runtime and feeds them to the chart config, so the chart
 * matches light/dark like the rest of your UI. Pair with chartjs.css (the card
 * skin) and theme/theme.css (the tokens).
 *
 * Why reach for this over Micra's native SVG Charts? Native covers ~90% (stacked,
 * legend toggle, crosshair tooltip, mixed/dual-axis). This is the escape hatch
 * for the rest: a real TIME x-axis (Date values), ZOOM / PAN, scatter / bubble,
 * and a canvas that stays smooth with tens of thousands of points.
 *
 * The integration pattern (same as every library wrapper):
 *   onCreate  — build the Chart on the <canvas>, wire its events into state.
 *   onDestroy — chart.destroy(). Chart.js LEAKS without this: it keeps the canvas,
 *               its resize observers and animation handles alive, so under htmx /
 *               Astro island swaps you get detached canvases piling up. Always
 *               destroy. Micra.autoCleanup() calls onDestroy when the island goes.
 *
 * Markup contract (see index.html):
 *   <div data-component="chartjs" data-kind="line">
 *     <div class="micra-chart">
 *       <canvas data-ref="canvas"></canvas>
 *     </div>
 *     …reactive UI bound to isZoomed(), pointCount(), kind…
 *   </div>
 *
 * The host passes the dataset/config in via Micra.chartjsData(root) (a hook the
 * demo defines) or by reading data-* props; here we keep the config builder in
 * the wrapper so the theming logic lives in one place.
 */
Micra.define('chartjs', {
  state: {
    kind: 'line',     // 'line' | 'bar' — the primary dataset's render type
    zoomed: false,    // mirrors the zoom plugin's state, for a reactive readout
    showScatter: true, // whether the scatter dataset is visible
  },

  onCreate() {
    this._canvas = this.refs.canvas;
    if (!this._canvas || typeof Chart === 'undefined') return;

    this.state.kind = this.prop('kind', 'line') || 'line';

    // The host hands us the raw series. Keep data out of the wrapper so the same
    // component drives any chart; the demo sets window.__chartData per root.
    this._series = (window.chartjsSeries && window.chartjsSeries(this.$el)) || {
      time: [],
      scatter: [],
    };

    // Build once; applyTheme() re-reads tokens and updates in place afterwards.
    this._chart = new Chart(this._canvas, this._config());

    // Mirror the zoom plugin's state into Micra state so the "Reset zoom" button
    // and the "zoomed" indicator react. These are Chart.js config callbacks, not
    // DOM events, so they're set in _config(); here we just keep the handles.
  },

  onDestroy() {
    // The whole point of the wrapper. Without this, Chart.js leaks the canvas and
    // its observers across swaps.
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }
  },

  // — config builder ————————————————————————————————————————————
  // Read tokens fresh each time so applyTheme() picks up a theme switch.
  _token(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  },

  _config() {
    const fg = this._token('--micra-fg');
    const muted = this._token('--micra-muted');
    const border = this._token('--micra-border');
    const primary = this._token('--micra-primary');
    const success = this._token('--micra-success');
    const warning = this._token('--micra-warning');
    const surface = this._token('--micra-surface');

    const self = this;

    return {
      type: this.state.kind,
      data: {
        datasets: [
          {
            label: 'Sessions',
            type: this.state.kind,
            data: this._series.time, // [{ x: Date|ms, y: Number }, …]
            borderColor: primary,
            backgroundColor: color(primary, 0.15),
            pointBackgroundColor: primary,
            pointRadius: this.state.kind === 'line' ? 0 : 2,
            borderWidth: 2,
            tension: 0.25,
            fill: this.state.kind === 'line',
          },
          {
            label: 'Anomalies',
            type: 'scatter',
            data: this._series.scatter, // [{ x: Date|ms, y: Number }, …]
            borderColor: warning,
            backgroundColor: success, // distinct fill so points read on any line
            pointRadius: 4,
            pointHoverRadius: 6,
            hidden: !this.state.showScatter,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            // The escape hatch: a real time axis. Needs the date-fns adapter
            // script (it self-registers). Values are Date or epoch ms.
            type: 'time',
            time: { tooltipFormat: 'PP p', unit: 'day' },
            grid: { color: border },
            border: { color: border },
            ticks: { color: muted, maxRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: true,
            grid: { color: border },
            border: { color: border },
            ticks: { color: muted },
          },
        },
        plugins: {
          legend: {
            labels: { color: fg, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: surface,
            titleColor: fg,
            bodyColor: fg,
            borderColor: border,
            borderWidth: 1,
          },
          // The zoom plugin. Registered globally (see index.html). Drag-to-zoom
          // on x, wheel to zoom, drag to pan. onZoom/onPan mirror state so Micra
          // can show a "zoomed" badge and enable "Reset zoom".
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              onPanComplete: () => self._syncZoomed(),
            },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              drag: {
                enabled: true,
                backgroundColor: color(primary, 0.12),
                borderColor: primary,
                borderWidth: 1,
              },
              mode: 'x',
              onZoomComplete: () => self._syncZoomed(),
            },
          },
        },
      },
    };
  },

  // Read the current x-axis zoom level off the chart and reflect it into state.
  _syncZoomed() {
    if (!this._chart) return;
    // getZoomLevel() comes from the zoom plugin; >1 means zoomed in.
    const level =
      typeof this._chart.getZoomLevel === 'function'
        ? this._chart.getZoomLevel()
        : 1;
    this.state.zoomed = level > 1.001;
  },

  // — derived (methods, never state) ————————————————————————————
  isZoomed() {
    return this.state.zoomed;
  },

  // Total plotted points across visible datasets — a cheap "how big is this" read.
  pointCount() {
    if (!this._chart) return 0;
    return this._chart.data.datasets.reduce((n, ds, i) => {
      const visible = this._chart.isDatasetVisible(i);
      return visible ? n + (ds.data ? ds.data.length : 0) : n;
    }, 0);
  },

  kindLabel() {
    return this.state.kind === 'line' ? 'Line' : 'Bar';
  },

  // — theming ———————————————————————————————————————————————————
  // Re-read every --micra-* token and push the new colors into the live chart.
  // Call this from your theme toggle: Chart.js has no theme awareness, so this
  // method IS the dark-mode support. Rebuilds the options/colors, then update().
  applyTheme() {
    if (!this._chart) return;
    const fresh = this._config();
    // Recolor in place rather than recreating the chart (keeps zoom/pan state).
    this._chart.options = fresh.options;
    this._chart.data.datasets.forEach((ds, i) => {
      const src = fresh.data.datasets[i];
      if (!src) return;
      ds.borderColor = src.borderColor;
      ds.backgroundColor = src.backgroundColor;
      ds.pointBackgroundColor = src.pointBackgroundColor;
    });
    this._chart.update();
  },

  // — actions ——————————————————————————————————————————————————
  // Switch the primary dataset (and chart) between line and bar. Writing state
  // re-renders the Micra UI; we drive Chart.js imperatively here.
  setKind(kind) {
    if (kind !== 'line' && kind !== 'bar') return;
    this.state.kind = kind;
    if (!this._chart) return;
    const ds = this._chart.data.datasets[0];
    ds.type = kind;
    this._chart.config.type = kind;
    ds.fill = kind === 'line';
    ds.pointRadius = kind === 'line' ? 0 : 2;
    this._chart.update();
  },

  toggleLine() {
    this.setKind('line');
  },

  toggleBar() {
    this.setKind('bar');
  },

  // Show / hide the scatter dataset. State drives the button label; we toggle
  // visibility on the chart and update.
  toggleScatter() {
    this.state.showScatter = !this.state.showScatter;
    if (!this._chart) return;
    this._chart.setDatasetVisibility(1, this.state.showScatter);
    this._chart.update();
  },

  // resetZoom() is added to the chart instance by the zoom plugin.
  resetZoom() {
    if (this._chart && typeof this._chart.resetZoom === 'function') {
      this._chart.resetZoom();
    }
    this.state.zoomed = false;
  },
});

// Small helper: turn a token color into an rgba-ish translucent fill. Chart.js
// accepts any CSS color string, so color-mix works in modern browsers.
function color(c, alpha) {
  return `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`;
}
