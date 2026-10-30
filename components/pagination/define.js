/*
 * components/pagination/define.js — Pagination (headless behavior).
 *
 * Pair with pagination.css (default skin) and theme/theme.css (tokens). The
 * markup renders the page items from pages() via data-each; this file owns the
 * behavior: clamping, prev/next, selection, and the truncation logic that keeps
 * the control a fixed width by collapsing runs of pages into ellipsis gaps.
 *
 * State holds raw data only — page (1-based) and total. The render list, the
 * bound state, and the at-bounds checks are all methods, never state. select /
 * prev / next emit a 'change' event with the new page number, so a host can fetch
 * the matching slice (this.on('change', …)).
 *
 * Markup contract:
 *   <nav data-component="pagination" data-page="1" data-total="12"
 *        aria-label="Pagination">
 *     <button @click="prev" data-bind="disabled:atStart(), …">Previous</button>
 *     <template data-each="pages()" data-key="key"> … page button / gap span … </template>
 *     <button @click="next" data-bind="disabled:atEnd(), …">Next</button>
 *   </nav>
 */
Micra.define('pagination', {
  state: { page: 1, total: 1 },

  onCreate() {
    // Read host config and fall back well. Numeric props cast when present; a
    // bare attribute would be "" (falsy), so the defaults guard that too.
    this.state.total = Math.max(1, this.prop('total', 1));
    this._siblings = Math.max(0, this.prop('siblingCount', 1));
    this.state.page = this._clamp(this.prop('page', 1));
  },

  // — navigation ————————————————————————————————————————————————
  select(n) {
    const page = this._clamp(n);
    if (page === this.state.page) return;
    this.state.page = page;
    this.emit('change', page);
  },

  prev() {
    this.select(this.state.page - 1);
  },

  next() {
    this.select(this.state.page + 1);
  },

  // — derived (methods, never state) ——————————————————————————————
  isCurrent(n) {
    return n === this.state.page;
  },

  atStart() {
    return this.state.page <= 1;
  },

  atEnd() {
    return this.state.page >= this.state.total;
  },

  // The render list: always first and last, a sibling window around the current
  // page, and ellipsis gaps for the runs in between. Each item carries a stable
  // key so data-each can diff cleanly — pages key by their number, gaps key by
  // the side they sit on, so the two possible gaps never collide.
  pages() {
    const total = this.state.total;
    const current = this.state.page;
    const span = this._siblings ?? 1; // the first render runs before onCreate

    // Few enough pages to show them all — no truncation needed.
    if (total <= span * 2 + 5) {
      return this._range(1, total).map((n) => this._page(n));
    }

    const left = Math.max(current - span, 1);
    const right = Math.min(current + span, total);

    // Show a gap on a side only when it hides more than the single page a gap
    // would occupy — otherwise render that page instead of an ellipsis.
    const gapLeft = left > 3;
    const gapRight = right < total - 2;

    const items = [this._page(1)];

    if (gapLeft) items.push(this._gap('start'));
    else if (left === 3) items.push(this._page(2));

    // First and last are pushed separately, so the window stops short of them.
    for (let n = Math.max(left, 2); n <= Math.min(right, total - 1); n++) items.push(this._page(n));

    if (gapRight) items.push(this._gap('end'));
    else if (right === total - 2) items.push(this._page(total - 1));

    items.push(this._page(total));
    return items;
  },

  // — internals ————————————————————————————————————————————————
  _clamp(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return this.state.page;
    return Math.min(Math.max(Math.round(n), 1), this.state.total);
  },

  _range(start, end) {
    const out = [];
    for (let n = start; n <= end; n++) out.push(n);
    return out;
  },

  _page(n) {
    return { key: 'p' + n, type: 'page', n };
  },

  _gap(side) {
    return { key: 'gap-' + side, type: 'gap' };
  },
});
