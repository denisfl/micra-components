/*
 * components/charts/define.js — Charts (bar / line / pie).
 *
 * A small, honest charting primitive. Pair with charts.css (default skin) and
 * theme/theme.css (tokens). Bar and line render a value (Y) axis with gridlines
 * and one OR MORE series; pie renders a single series as slices. This file owns
 * the geometry and the data; the skin owns colors (via tokens), sizing, and motion.
 *
 * Data model (normalized internally to { categories, series }):
 *   - Single series (legacy):  [{ label, value }, …]
 *   - Multi-column (legacy):   [{ label, values: [n, n, …] }, …]
 *   - Multi-series (explicit): { categories: [...], series: [{ name, data: [...] }] }
 *   For type 'mixed', a series may also carry kind ('bar' | 'line') and axis
 *   ('left' | 'right') to combine bars + lines and a second Y scale.
 *   Bar groups one bar per series at each category; line draws one polyline per
 *   series; pie uses the FIRST series (slices = categories); mixed honors per-series
 *   kind/axis.
 *
 * SVG rendering — why a string, not nested SVG markup:
 *   Micra's <template data-each> is an HTML control-flow element and does not
 *   compose inside <svg>, and data-bind cannot reliably set individual SVG geometry
 *   attributes. So we build the WHOLE <svg>…</svg> as a string in svg() and hand it
 *   to a wrapper via data-html. When state changes, svg() recomputes and data-html
 *   replaces the wrapper's innerHTML. Interactions live INSIDE the string as plain
 *   SVG (a native <title> per shape + CSS :hover) — no @events in the string, since
 *   innerHTML written later is not re-scanned by Micra.
 *
 * Palette: token-driven. charts.css defines --micra-chart-1..4 (default to
 * --micra-primary / --micra-success / --micra-warning / --micra-error), and beyond
 * four cssColor() color-mixes steps of --micra-primary. Each series uses its index.
 *
 * State is a SHALLOW proxy: categories/series are REPLACED, never mutated in place.
 *
 * Public API:
 *   setData(input)    replace the dataset (any of the three forms above); re-renders.
 *   setType(type)     switch 'bar' | 'line' | 'pie' | 'mixed'; re-renders.
 *   setStacked(on)    bar -> stacked columns, line -> stacked areas (vs grouped).
 *   toggle(i)         hide/show a series (bar/line) or slice (pie); axis rescales.
 *                     Driven by the legend's @click; keeps at least one visible.
 */
Micra.define('charts', {
  state: {
    type: 'bar',      // 'bar' | 'line' | 'pie'
    categories: [],   // x-axis category labels
    series: [],       // [{ name, data: [numbers aligned to categories] }]
    stacked: false,   // bar -> stacked columns; line -> stacked areas
    hidden: [],       // toggled-off indices (series for bar/line, slices for pie)
  },

  onCreate() {
    const t = this.prop('type', 'bar');
    this.state.type = ['bar', 'line', 'pie', 'mixed'].includes(t) ? t : 'bar';
    this.state.stacked = this.prop('stacked', false) !== false;
    const seed = this._normalize(this.prop('data', {}));
    this.state.categories = seed.categories;
    this.state.series = seed.series;
    this.state.hidden = [];
    this._initTooltip();
  },

  onDestroy() {
    if (this._plotEl) {
      this._plotEl.removeEventListener('pointermove', this._onMove);
      this._plotEl.removeEventListener('pointerleave', this._onLeave);
    }
  },

  // — public API ————————————————————————————————————————————————
  setData(input) {
    const n = this._normalize(input);
    this.state.categories = n.categories;
    this.state.series = n.series;
    this.state.hidden = []; // indices change with the dataset
  },

  setType(type) {
    if (['bar', 'line', 'pie', 'mixed'].includes(type)) {
      this.state.type = type;
      // pie toggles slices (category indices), bar/line toggle series — reset.
      this.state.hidden = [];
    }
  },

  setStacked(on) {
    this.state.stacked = !!on;
  },

  // Legend click: hide/show a series (bar/line) or slice (pie). Keeps at least one
  // visible, then re-renders — the value axis rescales to what's left, like Chart.js.
  toggle(i) {
    const { type, categories, series } = this.state;
    if (type !== 'pie' && series.length < 2) return; // single series: nothing to toggle
    const n = type === 'pie' ? categories.length : series.length;
    const hidden = this.state.hidden.slice();
    const at = hidden.indexOf(i);
    if (at >= 0) {
      hidden.splice(at, 1);
    } else {
      if (hidden.length >= n - 1) return; // never hide the last visible one
      hidden.push(i);
    }
    this.state.hidden = hidden;
  },

  // — interactive tooltip + crosshair ————————————————————————————
  // The SVG is injected via data-html and carries no @events, so the tooltip lives
  // in an HTML overlay: a crosshair line + a value box, positioned by ONE pointer
  // handler on the plot wrapper. Hit-testing reads geometry stashed by svg() in
  // this._hit (bar/line only; null for pie, which keeps its native slice titles).
  _initTooltip() {
    const plot = this.$el.querySelector('.micra-charts__plot');
    if (!plot) return;
    this._plotEl = plot;
    this._cross = document.createElement('div');
    this._cross.className = 'micra-charts__crosshair';
    this._cross.hidden = true;
    this._tip = document.createElement('div');
    this._tip.className = 'micra-charts__tooltip';
    this._tip.hidden = true;
    this.$el.append(this._cross, this._tip);
    this._onMove = (e) => this._tipMove(e);
    this._onLeave = () => this._tipHide();
    plot.addEventListener('pointermove', this._onMove);
    plot.addEventListener('pointerleave', this._onLeave);
  },

  _tipMove(e) {
    const hit = this._hit;
    if (!hit || !hit.cols.length) return this._tipHide();
    const svg = this._plotEl.querySelector('svg');
    if (!svg) return this._tipHide();
    const svgRect = svg.getBoundingClientRect();
    const rootRect = this.$el.getBoundingClientRect();
    const scale = svgRect.width / hit.W; // uniform (xMidYMid meet, height:auto)
    const vbx = (e.clientX - svgRect.left) / scale;

    let best = 0, bestD = Infinity;
    hit.cols.forEach((c, i) => { const d = Math.abs(c.x - vbx); if (d < bestD) { bestD = d; best = i; } });
    const col = hit.cols[best];

    const lineX = svgRect.left + col.x * scale - rootRect.left;
    this._cross.style.left = lineX + 'px';
    this._cross.style.top = svgRect.top + hit.mTop * scale - rootRect.top + 'px';
    this._cross.style.height = hit.plotH * scale + 'px';
    this._cross.hidden = false;

    const rows = col.rows.map((r) =>
      `<div class="micra-charts__tip-row">` +
        `<span class="micra-charts__tip-swatch" style="background:${r.color}"></span>` +
        `<span class="micra-charts__tip-name">${this._esc(r.name || 'Value')}</span>` +
        `<span class="micra-charts__tip-val">${this._esc(this._fmt(r.value))}</span>` +
      `</div>`
    ).join('');
    this._tip.innerHTML = `<div class="micra-charts__tip-title">${this._esc(col.label)}</div>${rows}`;
    this._tip.hidden = false;

    let tx = lineX + 12;
    if (tx + this._tip.offsetWidth > rootRect.width) tx = lineX - this._tip.offsetWidth - 12;
    if (tx < 0) tx = 0;
    let ty = e.clientY - rootRect.top - this._tip.offsetHeight - 12;
    if (ty < 0) ty = e.clientY - rootRect.top + 16;
    this._tip.style.left = tx + 'px';
    this._tip.style.top = ty + 'px';
  },

  _tipHide() {
    if (this._cross) this._cross.hidden = true;
    if (this._tip) this._tip.hidden = true;
  },

  // Normalize any accepted input shape into { categories, series:[{name,data}] }.
  _normalize(input) {
    // Explicit multi-series object.
    if (input && !Array.isArray(input) && Array.isArray(input.series)) {
      const categories = Array.isArray(input.categories) ? input.categories.map(String) : [];
      const series = input.series
        .filter((s) => s && Array.isArray(s.data))
        .map((s) => {
          const o = { name: s.name != null ? String(s.name) : '', data: s.data };
          if (s.kind === 'line' || s.kind === 'bar') o.kind = s.kind; // mixed: per-series render
          if (s.axis === 'right' || s.axis === 'left') o.axis = s.axis; // mixed: dual Y scale
          return o;
        });
      return { categories, series };
    }
    // Legacy array forms.
    if (Array.isArray(input)) {
      const rows = input.filter((d) => d && d.label != null);
      const categories = rows.map((d) => String(d.label));
      if (rows.some((d) => Array.isArray(d.values))) {
        const cols = Math.max(0, ...rows.map((d) => (Array.isArray(d.values) ? d.values.length : 0)));
        const series = [];
        for (let c = 0; c < cols; c++) {
          series.push({ name: '', data: rows.map((d) => (Array.isArray(d.values) ? d.values[c] : 0)) });
        }
        return { categories, series };
      }
      return { categories, series: [{ name: '', data: rows.map((d) => d.value) }] };
    }
    return { categories: [], series: [] };
  },

  // — the SVG string (the render) ——————————————————————————————
  svg() {
    const { categories, series, type } = this.state;
    this._hit = null; // bar/line repopulate; pie leaves it null (native slice titles)
    if (!categories.length || !series.length) return this._emptySvg();
    if (type === 'pie') return this._pieSvg(categories, series);
    if (type === 'mixed') return this._mixedSvg(categories, series);
    if (type === 'line') return this._lineSvg(categories, series);
    return this._barSvg(categories, series);
  },

  // — BAR (grouped or stacked) ——————————————————————————————————————
  _barSvg(categories, series) {
    const W = 640, H = 360;
    const m = { top: 28, right: 16, bottom: 40, left: 48 };
    const plotW = W - m.left - m.right, plotH = H - m.top - m.bottom, baseY = m.top + plotH;
    const hidden = this.state.hidden, stacked = this.state.stacked;
    const max = this._computeMax(series, hidden, stacked);
    const slot = plotW / categories.length;
    const groupW = slot * 0.7;
    const vis = series.map((s, i) => ({ s, i })).filter((o) => !hidden.includes(o.i));

    const parts = this._axisParts(m, plotW, plotH, baseY, max);

    categories.forEach((cat, i) => {
      const gx = m.left + i * slot + (slot - groupW) / 2;
      const cx = m.left + i * slot + slot / 2;

      if (stacked) {
        // One column per category; visible series stacked bottom-up (positives only).
        let cumH = 0;
        vis.forEach((o) => {
          const v = this._num(o.s.data[i]);
          if (v <= 0) return;
          const h = max > 0 ? (v / max) * plotH : 0;
          const y = baseY - cumH - h;
          parts.push(
            `<g class="micra-charts__bar-g">` +
              `<rect class="micra-charts__bar" x="${this._r(gx)}" y="${this._r(y)}" ` +
              `width="${this._r(groupW)}" height="${this._r(h)}" rx="2" fill="${this.cssColor(o.i)}" ` +
              `style="--bar-base:${this._r(baseY)}px"></rect>` +
            `</g>`
          );
          cumH += h;
        });
      } else {
        // Grouped: one bar per visible series, side by side.
        const S = Math.max(1, vis.length);
        const bw = groupW / S;
        vis.forEach((o, vi) => {
          const v = this._num(o.s.data[i]);
          const h = max > 0 ? (v / max) * plotH : 0;
          const x = gx + vi * bw;
          const y = baseY - h;
          parts.push(
            `<g class="micra-charts__bar-g">` +
              `<rect class="micra-charts__bar" x="${this._r(x)}" y="${this._r(y)}" ` +
              `width="${this._r(bw * 0.9)}" height="${this._r(h)}" rx="2" fill="${this.cssColor(o.i)}" ` +
              `style="--bar-base:${this._r(baseY)}px"></rect>` +
              // value label only when a single series is visible (avoids clutter)
              (vis.length === 1
                ? `<text class="micra-charts__value" x="${this._r(x + bw * 0.45)}" y="${this._r(y - 8)}" text-anchor="middle">${this._esc(this._fmt(v))}</text>`
                : '') +
            `</g>`
          );
        });
      }
      parts.push(`<text class="micra-charts__xlabel" x="${this._r(cx)}" y="${baseY + 22}" text-anchor="middle">${this._esc(cat)}</text>`);
    });

    this._hit = {
      W, H, mTop: m.top, plotH,
      cols: categories.map((cat, i) => ({
        x: m.left + i * slot + slot / 2,
        label: cat,
        rows: vis.map((o) => ({ name: o.s.name, color: this.cssColor(o.i), value: this._num(o.s.data[i]) })),
      })),
    };
    return this._wrapSvg(W, H, parts.join(''));
  },

  // — LINE (overlapping lines, or stacked areas) ———————————————————
  _lineSvg(categories, series) {
    const W = 640, H = 360;
    const m = { top: 28, right: 20, bottom: 40, left: 48 };
    const plotW = W - m.left - m.right, plotH = H - m.top - m.bottom, baseY = m.top + plotH;
    const hidden = this.state.hidden, stacked = this.state.stacked;
    const max = this._computeMax(series, hidden, stacked);
    const stepX = categories.length > 1 ? plotW / (categories.length - 1) : 0;
    const xAt = (i) => m.left + (categories.length > 1 ? i * stepX : plotW / 2);
    const yAt = (v) => (max > 0 ? baseY - (this._num(v) / max) * plotH : baseY);
    const vis = series.map((s, i) => ({ s, i })).filter((o) => !hidden.includes(o.i));

    const parts = this._axisParts(m, plotW, plotH, baseY, max);
    const lineLen = (pts) => {
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      return len;
    };
    const dot = (o, p) =>
      `<circle class="micra-charts__dot" cx="${this._r(p.x)}" cy="${this._r(p.y)}" r="4" fill="${this.cssColor(o.i)}"></circle>`;

    if (stacked) {
      // Stacked areas: each visible series is a band on top of the running total.
      const prev = categories.map(() => 0);
      vis.forEach((o) => {
        const top = categories.map((_c, i) => prev[i] + Math.max(0, this._num(o.s.data[i])));
        const topPts = top.map((v, i) => ({ x: xAt(i), y: yAt(v), v: this._num(o.s.data[i]) }));
        const botPts = prev.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
        const stroke = this.cssColor(o.i);
        const band =
          topPts.map((p) => `${this._r(p.x)},${this._r(p.y)}`).join(' ') + ' ' +
          botPts.slice().reverse().map((p) => `${this._r(p.x)},${this._r(p.y)}`).join(' ');
        parts.push(`<polygon class="micra-charts__area micra-charts__area--stack" points="${band}" fill="${stroke}"/>`);
        const line = topPts.map((p) => `${this._r(p.x)},${this._r(p.y)}`).join(' ');
        parts.push(`<polyline class="micra-charts__line" points="${line}" fill="none" stroke="${stroke}" style="--line-len:${this._r(lineLen(topPts))}"/>`);
        topPts.forEach((p) => parts.push(dot(o, p)));
        for (let i = 0; i < categories.length; i++) prev[i] = top[i];
      });
    } else {
      const single = vis.length === 1;
      vis.forEach((o) => {
        const pts = categories.map((c, i) => ({ x: xAt(i), y: yAt(o.s.data[i]), v: this._num(o.s.data[i]), label: c }));
        const line = pts.map((p) => `${this._r(p.x)},${this._r(p.y)}`).join(' ');
        const stroke = this.cssColor(o.i);
        if (single) {
          const area = `${this._r(pts[0].x)},${baseY} ` + line + ` ${this._r(pts[pts.length - 1].x)},${baseY}`;
          parts.push(`<polygon class="micra-charts__area" points="${area}" fill="${stroke}"/>`);
        }
        parts.push(`<polyline class="micra-charts__line" points="${line}" fill="none" stroke="${stroke}" style="--line-len:${this._r(lineLen(pts))}"/>`);
        pts.forEach((p) => parts.push(dot(o, p)));
      });
    }

    categories.forEach((c, i) =>
      parts.push(`<text class="micra-charts__xlabel" x="${this._r(xAt(i))}" y="${baseY + 22}" text-anchor="middle">${this._esc(c)}</text>`)
    );

    this._hit = {
      W, H, mTop: m.top, plotH,
      cols: categories.map((c, i) => ({
        x: xAt(i),
        label: c,
        rows: vis.map((o) => ({ name: o.s.name, color: this.cssColor(o.i), value: this._num(o.s.data[i]) })),
      })),
    };
    return this._wrapSvg(W, H, parts.join(''));
  },

  // — MIXED (bars + lines, optional dual Y axis) ———————————————————
  // Per-series `kind` ('bar' | 'line', default bar) and `axis` ('left' | 'right',
  // default left). Bar-kind series group side by side; line-kind draw over them.
  // Left axis = primary (grid). Right axis = its own scale + labels, drawn only if
  // a series is assigned to it. Classic revenue-bars + margin-line combo.
  _mixedSvg(categories, series) {
    const W = 640, H = 360;
    const m = { top: 28, right: 48, bottom: 40, left: 48 };
    const plotW = W - m.left - m.right, plotH = H - m.top - m.bottom, baseY = m.top + plotH;
    const hidden = this.state.hidden;
    const vis = series.map((s, i) => ({ s, i })).filter((o) => !hidden.includes(o.i));
    const isLine = (o) => o.s.kind === 'line';
    const onRight = (o) => o.s.axis === 'right';
    const leftMax = this._setMax(vis.filter((o) => !onRight(o)));
    const rightSet = vis.filter(onRight);
    const rightMax = this._setMax(rightSet);
    const slot = plotW / categories.length;
    const cxAt = (i) => m.left + i * slot + slot / 2;
    const yOf = (o, v) => {
      const max = onRight(o) ? rightMax : leftMax;
      return max > 0 ? baseY - (this._num(v) / max) * plotH : baseY;
    };

    // Left (primary) grid + labels + baseline.
    const parts = this._axisParts(m, plotW, plotH, baseY, leftMax);

    // Right axis: own labels + a vertical axis line (only when something uses it).
    if (rightSet.length) {
      this._ticks(rightMax, 4).forEach((t) => {
        const y = baseY - (rightMax > 0 ? (t / rightMax) * plotH : 0);
        parts.push(`<text class="micra-charts__ylabel" x="${this._r(m.left + plotW + 8)}" y="${this._r(y)}" text-anchor="start" dominant-baseline="central">${this._esc(this._fmt(t))}</text>`);
      });
      parts.push(`<line class="micra-charts__axis" x1="${this._r(m.left + plotW)}" y1="${m.top}" x2="${this._r(m.left + plotW)}" y2="${baseY}"/>`);
    }

    // Bars first (grouped among the bar-kind series), then lines over them.
    const barSet = vis.filter((o) => !isLine(o));
    const groupW = slot * 0.7;
    const bw = groupW / Math.max(1, barSet.length);
    categories.forEach((cat, i) => {
      const gx = cxAt(i) - groupW / 2;
      barSet.forEach((o, bi) => {
        const y = yOf(o, o.s.data[i]);
        const h = Math.max(0, baseY - y);
        parts.push(
          `<g class="micra-charts__bar-g">` +
            `<rect class="micra-charts__bar" x="${this._r(gx + bi * bw)}" y="${this._r(y)}" width="${this._r(bw * 0.9)}" height="${this._r(h)}" rx="2" fill="${this.cssColor(o.i)}" style="--bar-base:${this._r(baseY)}px"></rect>` +
          `</g>`
        );
      });
    });

    vis.filter(isLine).forEach((o) => {
      const pts = categories.map((_c, i) => ({ x: cxAt(i), y: yOf(o, o.s.data[i]) }));
      const line = pts.map((p) => `${this._r(p.x)},${this._r(p.y)}`).join(' ');
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const stroke = this.cssColor(o.i);
      parts.push(`<polyline class="micra-charts__line" points="${line}" fill="none" stroke="${stroke}" style="--line-len:${this._r(len)}"/>`);
      pts.forEach((p) => parts.push(`<circle class="micra-charts__dot" cx="${this._r(p.x)}" cy="${this._r(p.y)}" r="4" fill="${stroke}"></circle>`));
    });

    categories.forEach((cat, i) =>
      parts.push(`<text class="micra-charts__xlabel" x="${this._r(cxAt(i))}" y="${baseY + 22}" text-anchor="middle">${this._esc(cat)}</text>`)
    );

    this._hit = {
      W, H, mTop: m.top, plotH,
      cols: categories.map((cat, i) => ({
        x: cxAt(i),
        label: cat,
        rows: vis.map((o) => ({ name: o.s.name, color: this.cssColor(o.i), value: this._num(o.s.data[i]) })),
      })),
    };
    return this._wrapSvg(W, H, parts.join(''));
  },

  // — PIE / DONUT (first series) ———————————————————————————————————
  _pieSvg(categories, series) {
    const W = 360, H = 360;
    const cx = W / 2, cy = H / 2;
    const r = 150;
    const hole = Math.min(Math.max(this._num(this.prop('hole', 0)), 0), 0.9);
    const ri = r * hole;
    const data = series[0].data;
    const hidden = this.state.hidden;

    const vis = categories.map((_c, i) => i).filter((i) => !hidden.includes(i));
    const total = vis.reduce((s, i) => s + Math.max(0, this._num(data[i])), 0);
    if (total <= 0) return this._emptySvg();

    const parts = [];
    let a0 = -Math.PI / 2;

    vis.forEach((i) => {
      const cat = categories[i];
      const frac = Math.max(0, this._num(data[i])) / total;
      const a1 = a0 + frac * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      const fill = this.cssColor(i);
      const pct = Math.round(frac * 100);

      if (frac >= 0.9999) {
        parts.push(
          ri > 0
            ? `<path class="micra-charts__slice" fill="${fill}" fill-rule="evenodd" d="${this._ringPath(cx, cy, r, ri)}"><title>${this._esc(cat)}: 100%</title></path>`
            : `<circle class="micra-charts__slice" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"><title>${this._esc(cat)}: 100%</title></circle>`
        );
      } else {
        parts.push(
          `<path class="micra-charts__slice" fill="${fill}" d="${this._slicePath(cx, cy, r, ri, a0, a1)}">` +
            `<title>${this._esc(cat)}: ${this._esc(this._fmt(this._num(data[i])))} (${pct}%)</title>` +
          `</path>`
        );
      }

      if (frac >= 0.05) {
        const lr = ri + (r - ri) * 0.62;
        const lx = cx + Math.cos(mid) * lr;
        const ly = cy + Math.sin(mid) * lr;
        parts.push(
          `<text class="micra-charts__slice-label" x="${this._r(lx)}" y="${this._r(ly)}" text-anchor="middle" dominant-baseline="central">${pct}%</text>`
        );
      }
      a0 = a1;
    });

    return this._wrapSvg(W, H, parts.join(''));
  },

  // — value (Y) axis: gridlines + numeric labels + a strong baseline ————
  _axisParts(m, plotW, plotH, baseY, max) {
    const ticks = this._ticks(max, 4);
    const out = [];
    ticks.forEach((t) => {
      const y = baseY - (max > 0 ? (t / max) * plotH : 0);
      out.push(`<line class="micra-charts__grid" x1="${m.left}" y1="${this._r(y)}" x2="${this._r(m.left + plotW)}" y2="${this._r(y)}"/>`);
      out.push(`<text class="micra-charts__ylabel" x="${m.left - 8}" y="${this._r(y)}" text-anchor="end" dominant-baseline="central">${this._esc(this._fmt(t))}</text>`);
    });
    out.push(`<line class="micra-charts__axis" x1="${m.left}" y1="${baseY}" x2="${this._r(m.left + plotW)}" y2="${baseY}"/>`);
    return out;
  },

  // — legend (plain HTML, outside the svg) ——————————————————————
  // pie -> per slice; multi-series bar/line -> per series; single-series -> per point.
  // Each item carries `index` (for toggle()), `hidden`, and `toggle` (is it clickable).
  legend() {
    const { type, categories, series, hidden } = this.state;
    if (!series.length) return [];
    if (type === 'pie') {
      const data = series[0].data;
      const vis = categories.map((_c, i) => i).filter((i) => !hidden.includes(i));
      const total = vis.reduce((s, i) => s + Math.max(0, this._num(data[i])), 0);
      const many = categories.length > 1;
      return categories.map((c, i) => {
        const v = this._num(data[i]);
        const off = hidden.includes(i);
        const pct = !off && total > 0 ? Math.round((Math.max(0, v) / total) * 100) : null;
        return { key: c + '#' + i, index: i, color: this.cssColor(i), label: c, value: this._fmt(v) + (pct != null ? ' (' + pct + '%)' : ''), hidden: off, toggle: many };
      });
    }
    if (series.length > 1) {
      return series.map((s, i) => ({ key: (s.name || 'Series ' + (i + 1)) + '#' + i, index: i, color: this.cssColor(i), label: s.name || 'Series ' + (i + 1), value: '', hidden: hidden.includes(i), toggle: true }));
    }
    const data = series[0].data;
    return categories.map((c, i) => ({ key: c + '#' + i, index: i, color: this.cssColor(0), label: c, value: this._fmt(this._num(data[i])), hidden: false, toggle: false }));
  },

  // — palette ————————————————————————————————————————————————————
  cssColor(i) {
    if (i < 4) return `var(--micra-chart-${i + 1})`;
    const step = ((i - 4) % 6) + 1;
    return `color-mix(in oklab, var(--micra-primary), var(--micra-bg) ${step * 12}%)`;
  },

  // — accessibility ——————————————————————————————————————————————
  ariaSummary() {
    const { type, categories, series } = this.state;
    const kind = type[0].toUpperCase() + type.slice(1);
    if (!categories.length || !series.length) return kind + ' chart: no data';
    if (type === 'pie') {
      const data = series[0].data;
      return 'Pie chart: ' + categories.map((c, i) => c + ' ' + this._fmt(this._num(data[i]))).join(', ');
    }
    const parts = series.map((s) => (s.name ? s.name + ': ' : '') + categories.map((c, i) => c + ' ' + this._fmt(this._num(s.data[i]))).join(', '));
    return kind + ' chart' + (series.length > 1 ? ' (' + series.length + ' series)' : '') + ': ' + parts.join('; ');
  },

  // The sr-only data list rows: one per category, values across series.
  dataList() {
    const { categories, series } = this.state;
    return categories.map((c, i) => ({
      key: c + '#' + i,
      label: c,
      value:
        series.length > 1
          ? series.map((s) => (s.name || 'Series') + ' ' + this._fmt(this._num(s.data[i]))).join('; ')
          : this._fmt(this._num((series[0] ? series[0].data : [])[i])),
    }));
  },

  plotState() {
    return this.state.type;
  },

  swatchStyle(color) {
    return { background: color };
  },

  // — geometry internals ————————————————————————————————————————
  _slicePath(cx, cy, r, ri, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    if (ri > 0) {
      const ix1 = cx + Math.cos(a1) * ri, iy1 = cy + Math.sin(a1) * ri;
      const ix0 = cx + Math.cos(a0) * ri, iy0 = cy + Math.sin(a0) * ri;
      return (
        `M ${this._r(x0)} ${this._r(y0)} ` +
        `A ${r} ${r} 0 ${large} 1 ${this._r(x1)} ${this._r(y1)} ` +
        `L ${this._r(ix1)} ${this._r(iy1)} ` +
        `A ${ri} ${ri} 0 ${large} 0 ${this._r(ix0)} ${this._r(iy0)} Z`
      );
    }
    return `M ${cx} ${cy} L ${this._r(x0)} ${this._r(y0)} A ${r} ${r} 0 ${large} 1 ${this._r(x1)} ${this._r(y1)} Z`;
  },

  _ringPath(cx, cy, r, ri) {
    const o = (rad) => `M ${cx - rad} ${cy} a ${rad} ${rad} 0 1 0 ${rad * 2} 0 a ${rad} ${rad} 0 1 0 ${-rad * 2} 0 Z`;
    return o(r) + ' ' + o(ri);
  },

  // — number / format helpers ——————————————————————————————————
  // Value-axis maximum over the VISIBLE series. Stacked -> max column sum;
  // otherwise -> max single value. Rounded up to a "nice" number for the ticks.
  _computeMax(series, hidden, stacked) {
    const vis = series.filter((_s, i) => !hidden.includes(i));
    if (!vis.length) return 1;
    if (stacked) {
      const cats = Math.max(0, ...vis.map((s) => s.data.length));
      let raw = 0;
      for (let c = 0; c < cats; c++) {
        let sum = 0;
        vis.forEach((s) => { const v = this._num(s.data[c]); if (v > 0) sum += v; });
        if (sum > raw) raw = sum;
      }
      return this._niceMax(raw);
    }
    return this._niceMax(Math.max(0, ...vis.flatMap((s) => s.data.map((v) => this._num(v)))));
  },

  // Nice max over a set of {s,i} entries (one axis of a mixed chart).
  _setMax(set) {
    if (!set.length) return 1;
    return this._niceMax(Math.max(0, ...set.flatMap((o) => o.s.data.map((v) => this._num(v)))));
  },

  _ticks(max, count) {
    const out = [];
    for (let i = 0; i <= count; i++) out.push((max / count) * i);
    return out;
  },

  _num(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  },

  _niceMax(max) {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  },

  _fmt(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return this._trim(v / 1e6) + 'M';
    if (a >= 1e4) return this._trim(v / 1e3) + 'k';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
  },

  _trim(n) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
  },

  _r(n) {
    return Math.round(n * 100) / 100;
  },

  // — svg shell + misc ——————————————————————————————————————————
  _wrapSvg(W, H, inner) {
    return (
      `<svg class="micra-charts__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false">` +
      inner +
      `</svg>`
    );
  },

  _emptySvg() {
    return (
      `<svg class="micra-charts__svg" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false">` +
      `<text class="micra-charts__empty" x="320" y="180" text-anchor="middle" dominant-baseline="central">No data</text>` +
      `</svg>`
    );
  },

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
});
