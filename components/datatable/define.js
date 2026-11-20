/*
 * components/datatable/define.js — Data Table (headless behavior).
 *
 * The flagship component. Pair with datatable.css (default skin) and
 * theme/theme.css (tokens). The markup renders rows/cells from rows() via nested
 * data-each; this file owns everything else: two data modes, multi-column sort,
 * global search, row selection with a tri-state header, bulk actions, CSV/JSON
 * export, and pagination — all keyboard- and ARIA-aware.
 *
 * Two modes, one API:
 *   CLIENT (default) — state.rows holds the FULL dataset. filtered() searches it,
 *     sorted() applies the multi-sort comparator, rows() slices the current page.
 *     Everything is derived; there is no round-trip.
 *   SERVER (data-server, or this.prop('server', false) !== false) — state.rows
 *     holds ONLY the current page (already filtered/sorted/paged by the backend),
 *     state.total holds the full count. Any change to sort/search/page/pageSize
 *     calls requestData(): if data-url is set we this.fetch() it; otherwise we
 *     emit('query', params) and the host answers by calling the public
 *     setData(rows, total).
 *
 * State is a SHALLOW proxy — arrays/objects are REPLACED, never mutated in place
 * (state.selected = [...]; state.sort = [...]). Every derived value — the view,
 * counts, selection tri-state, sort indicators, the pager — is a METHOD, never a
 * state field.
 *
 * The view shape (view()/rows()):
 *   { id, selected: <bool>, cells: [ { key, text, align } ] }
 * The cells are PRE-FLATTENED with their column formatter already applied. Micra
 * names every data-each scope variable `item`, so the OUTER item is the row and
 * the INNER data-each (item.cells) rebinds `item` to each cell — the cell loop
 * cannot reach back to the row, hence the pre-flattening. The selection cell sits
 * before the inner loop, so it still sees `item` as the row (item.id/item.selected).
 *
 * IMPORTANT — bind the view in markup as view(), NOT rows(): a Micra expression
 * resolves a bare identifier against state first, and state.rows (the dataset) is
 * an array, so `rows()` in an expression reads the array and throws "not a
 * function". view() has no state twin, so it resolves to the method. rows() is the
 * canonical name and is safe to call as this.rows() inside other methods; only the
 * template-side call must use view().
 *
 * ARIA values are bound as STRINGS, not bare booleans: aria-sort is
 * 'ascending'|'descending'|'none', aria-checked is 'true'|'false'|'mixed',
 * aria-disabled / aria-current are 'true'/'false' / 'page'. A boolean bind would
 * set/drop the attribute, which is wrong for an ARIA state value (and 'mixed' has
 * no boolean form). The real HTML `disabled` attr on prev/next is a boolean — its
 * presence is the correct semantics there.
 */
Micra.define('datatable', {
  state: {
    columns: [],     // [{ key, label, sortable?, align?, width?, format? }]
    rows: [],        // client: the full dataset; server: the current page only
    total: null,     // server: total row count; client: derived, ignored
    sort: [],        // [{ key, dir:'asc'|'desc' }] — multi-sort, primary first
    search: '',
    page: 1,
    pageSize: 10,
    selected: [],    // selected row ids (by rowKey, default 'id')
    loading: false,
    error: null,
    server: false,   // mode flag — set from this.prop('server', false) !== false
  },

  onCreate() {
    // A bare attribute (data-server) reads as "" — falsy, not true — so test
    // against !== false to treat presence-of-any-value as "on".
    this.state.server = this.prop('server', false) !== false;

    // Page size and the row key. prop() casts a present numeric to a number.
    this.state.pageSize = this.prop('pageSize', 10) || 10;
    this._rowKey = this.prop('rowKey', 'id') || 'id';
    this._debounceMs = this.prop('debounce', 250) || 250;

    // Columns / rows may be seeded as JSON props (data-columns / data-rows). The
    // An array default makes prop() parse the JSON (Micra 2.14+); REPLACE the array. Columns set in
    // JS (host code) can carry a real format function; JSON columns carry a string
    // format name (resolved by formatters() below) or none.
    const columns = this.prop('columns', []);
    if (Array.isArray(columns) && columns.length) this.state.columns = columns;

    const rows = this.prop('rows', []);
    if (Array.isArray(rows) && rows.length) this.state.rows = rows;

    // Server mode fetches its first page; client mode already has its data.
    if (this.state.server) this.requestData();
  },

  onDestroy() {
    // The search debounce is the only timer; clear any pending tick.
    if (this._searchTimer) clearTimeout(this._searchTimer);
  },

  // — public API ————————————————————————————————————————————————
  // Host entry point for SERVER mode: hand back a page plus the total count.
  // Replace the arrays (shallow proxy) and clear the loading flag.
  setData(rows, total) {
    this.state.rows = Array.isArray(rows) ? rows : [];
    this.state.total = total == null ? this.state.rows.length : total;
    this.state.error = null;
    this.state.loading = false;
  },

  // — sorting ————————————————————————————————————————————————————
  // Click a sortable header. e.shiftKey makes it ADDITIVE (build a secondary,
  // tertiary, … sort); a plain click REPLACES the sort with just this key. Each
  // key cycles asc -> desc -> removed.
  toggleSort(key, e) {
    const additive = !!(e && e.shiftKey);
    const current = this.state.sort.find((s) => s.key === key);

    let next;
    if (!additive) {
      // Replace mode: cycle this single key in isolation.
      if (!current) next = [{ key, dir: 'asc' }];
      else if (current.dir === 'asc') next = [{ key, dir: 'desc' }];
      else next = []; // was desc -> remove, back to unsorted
    } else {
      // Additive mode: cycle just this key within the existing list, keeping the
      // others in place and order (primary first).
      if (!current) {
        next = [...this.state.sort, { key, dir: 'asc' }];
      } else if (current.dir === 'asc') {
        next = this.state.sort.map((s) => (s.key === key ? { key, dir: 'desc' } : s));
      } else {
        next = this.state.sort.filter((s) => s.key !== key); // desc -> remove
      }
    }

    this.state.sort = next;
    if (this.state.server) this.requestData();
    // client mode: the re-render is automatic on the state write above.
  },

  // — search ————————————————————————————————————————————————————
  onSearch(e) {
    this.state.search = e.target.value;
    this.state.page = 1; // a new query always returns to the first page
    if (this.state.server) {
      // Debounce server round-trips so we don't fetch on every keystroke.
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this._searchTimer = null;
        this.requestData();
      }, this._debounceMs);
    }
  },

  // — pagination ————————————————————————————————————————————————
  goToPage(n) {
    const page = this._clampPage(n);
    if (page === this.state.page) return;
    this.state.page = page;
    if (this.state.server) this.requestData();
  },

  prevPage() { this.goToPage(this.state.page - 1); },
  nextPage() { this.goToPage(this.state.page + 1); },

  setPageSize(e) {
    const size = Number(e.target.value) || this.state.pageSize;
    this.state.pageSize = size;
    this.state.page = 1; // a resized page invalidates the current offset
    if (this.state.server) this.requestData();
  },

  // — selection ————————————————————————————————————————————————
  // Toggle one row by id. Always REPLACE state.selected (shallow proxy).
  toggleRow(id) {
    this.state.selected = this.isSelected(id)
      ? this.state.selected.filter((s) => s !== id)
      : [...this.state.selected, id];
  },

  // Tri-state header: if every row on the current page is already selected, clear
  // those ids; otherwise add the page's ids to the selection. Selection persists
  // across pages, so this only ever touches the current page's rows.
  toggleAllOnPage() {
    const ids = this._pageIds();
    if (this.allPageSelected()) {
      const drop = new Set(ids);
      this.state.selected = this.state.selected.filter((s) => !drop.has(s));
    } else {
      const merged = new Set(this.state.selected);
      ids.forEach((id) => merged.add(id));
      this.state.selected = [...merged];
    }
  },

  clearSelection() {
    this.state.selected = [];
  },

  // — bulk actions ——————————————————————————————————————————————
  // Hand the selected ids to the host. The host decides what 'delete' / 'archive'
  // / … mean; this component only owns the selection.
  bulk(action) {
    this.emit('bulk', { action, ids: [...this.state.selected] });
  },

  // — export ————————————————————————————————————————————————————
  // Build a file from exportRows() (selected if any, else the full filtered set)
  // and trigger a browser download via a Blob + object URL + a temporary <a>.
  // Browser-only by design — export is a client action.
  exportCSV() {
    const cols = this.state.columns;
    const head = cols.map((c) => this._csvCell(c.label != null ? c.label : c.key));
    const body = this.exportRows().map((row) =>
      cols.map((c) => this._csvCell(this.formatCell(c, this._cellValue(row, c), row))).join(',')
    );
    const csv = [head.join(','), ...body].join('\r\n');
    this._download(csv, 'text/csv;charset=utf-8', 'export.csv');
  },

  exportJSON() {
    const cols = this.state.columns;
    const data = this.exportRows().map((row) => {
      const out = {};
      cols.forEach((c) => {
        out[c.key] = this.formatCell(c, this._cellValue(row, c), row);
      });
      return out;
    });
    this._download(JSON.stringify(data, null, 2), 'application/json', 'export.json');
  },

  // — server fetch ——————————————————————————————————————————————
  // Build the query, set loading, and either fetch (data-url) or emit('query').
  // Always clears loading: fetch clears it in setData/catch; the emit path clears
  // it once the host calls setData (the host owns that), but we still clear here
  // for the emit case so a host that answers synchronously isn't left "loading".
  requestData() {
    const params = {
      sort: this.state.sort,
      search: this.state.search,
      page: this.state.page,
      pageSize: this.state.pageSize,
    };
    this.state.error = null;
    this.state.loading = true;

    const url = this.prop('url');
    if (url) {
      this.fetch(url, { query: this._flatQuery(params) })
        .then((res) => this.setData(res.rows, res.total))
        .catch((err) => {
          this.state.error = err && err.message ? err.message : 'Request failed';
          this.state.loading = false;
        });
    } else {
      // No URL: the host answers by calling setData(rows, total). Emit and hand
      // control over; setData will flip loading off when the host responds.
      this.emit('query', params);
    }
  },

  // — derived: the view ————————————————————————————————————————
  // CLIENT: search the full dataset (case-insensitive, across every column,
  // stringified). SERVER: the backend already filtered, so pass rows through.
  filtered() {
    if (this.state.server) return this.state.rows;
    const q = this.state.search.trim().toLowerCase();
    if (!q) return this.state.rows;
    const cols = this.state.columns;
    return this.state.rows.filter((row) =>
      cols.some((c) => {
        const v = this._cellValue(row, c);
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  },

  // CLIENT: apply the multi-sort comparator over filtered(). SERVER: untouched.
  sorted() {
    if (this.state.server) return this.filtered();
    const sort = this.state.sort;
    if (!sort.length) return this.filtered();
    const rows = [...this.filtered()]; // copy — never sort the state array in place
    rows.sort((a, b) => {
      for (const { key, dir } of sort) {
        const cmp = this._compare(a[key], b[key]);
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
    return rows;
  },

  // The render list. CLIENT: slice sorted() to the current page. SERVER: the page
  // is already the data. Either way, FLATTEN to { id, selected, cells } with each
  // cell's value already formatted, so the nested cell loop is self-contained.
  rows() {
    const source = this.state.server ? this.state.rows : this.sorted();
    const pageRows = this.state.server
      ? source
      : source.slice(this._pageStart(), this._pageStart() + this.state.pageSize);

    return pageRows.map((row) => {
      const id = row[this._rowKey];
      return {
        id,
        selected: this.isSelected(id),
        cells: this.state.columns.map((c) => ({
          key: c.key,
          text: this.formatCell(c, this._cellValue(row, c), row),
          align: c.align || 'left',
        })),
      };
    });
  },

  // The markup-facing alias for rows(). Bind data-each="view()" — NOT rows() —
  // because state.rows (the dataset array) shadows the rows() method in a Micra
  // expression, throwing "not a function". Both return the same flattened page.
  view() {
    return this.rows();
  },

  // — derived: counts, paging, labels ——————————————————————————
  totalRows() {
    return this.state.server
      ? (this.state.total == null ? this.state.rows.length : this.state.total)
      : this.filtered().length;
  },

  pageCount() {
    return Math.max(1, Math.ceil(this.totalRows() / this.state.pageSize));
  },

  // The numbered pager: first + last always, a sibling window around the current
  // page, and ellipsis gaps between (mirrors the Pagination component's logic).
  // Page items key by 'p<n>'; the two possible gaps key by their side.
  pages() {
    const total = this.pageCount();
    const current = this.state.page;
    const span = 1; // siblings on each side

    if (total <= span * 2 + 5) {
      return this._range(1, total).map((n) => ({ key: 'p' + n, type: 'page', n }));
    }

    const left = Math.max(current - span, 1);
    const right = Math.min(current + span, total);
    const gapLeft = left > 2;
    const gapRight = right < total - 1;

    const items = [{ key: 'p1', type: 'page', n: 1 }];
    if (gapLeft) items.push({ key: 'gap-start', type: 'gap' });
    else if (left === 2) items.push({ key: 'p2', type: 'page', n: 2 });

    for (let n = left; n <= right; n++) items.push({ key: 'p' + n, type: 'page', n });

    if (gapRight) items.push({ key: 'gap-end', type: 'gap' });
    else if (right === total - 1) items.push({ key: 'p' + (total - 1), type: 'page', n: total - 1 });

    items.push({ key: 'p' + total, type: 'page', n: total });
    return items;
  },

  isCurrentPage(n) {
    return n === this.state.page;
  },

  atFirstPage() {
    return this.state.page <= 1;
  },

  atLastPage() {
    return this.state.page >= this.pageCount();
  },

  // "11–20 of 240" — the visible slice over the total. Reads totalRows() so it is
  // correct in both modes; an empty result reads "0 of 0".
  rangeLabel() {
    const total = this.totalRows();
    if (total === 0) return '0 of 0';
    const start = this._pageStart() + 1;
    const end = Math.min(start + this.rows().length - 1, total);
    return start + '–' + end + ' of ' + total; // en dash
  },

  // — derived: selection ————————————————————————————————————————
  isSelected(id) {
    return this.state.selected.includes(id);
  },

  // True only when EVERY row on the current page is selected.
  allPageSelected() {
    const ids = this._pageIds();
    return ids.length > 0 && ids.every((id) => this.isSelected(id));
  },

  // The header checkbox tri-state, as an ARIA-ready STRING: 'true' when the whole
  // page is selected, 'false' when none of it is, 'mixed' for the in-between.
  // Computed over the CURRENT page's rows only.
  selectionState() {
    const ids = this._pageIds();
    const on = ids.filter((id) => this.isSelected(id)).length;
    if (on === 0) return 'false';
    if (on === ids.length) return 'true';
    return 'mixed';
  },

  // data-state token for the header box glyph (check vs dash vs empty).
  headerBoxState() {
    const s = this.selectionState();
    return s === 'true' ? 'checked' : s === 'mixed' ? 'mixed' : 'unchecked';
  },

  selectedCount() {
    return this.state.selected.length;
  },

  hasSelection() {
    return this.state.selected.length > 0;
  },

  // — derived: sort indicators ——————————————————————————————————
  // aria-sort value for a header: 'ascending' | 'descending' | 'none'.
  sortState(key) {
    const s = this.state.sort.find((x) => x.key === key);
    if (!s) return 'none';
    return s.dir === 'asc' ? 'ascending' : 'descending';
  },

  // The visible indicator next to a sortable label: an arrow plus, when more than
  // one column is sorted, a 1-based priority badge ("↑ 2"). Empty when unsorted.
  sortIndicator(key) {
    const idx = this.state.sort.findIndex((x) => x.key === key);
    if (idx === -1) return '';
    const arrow = this.state.sort[idx].dir === 'asc' ? '↑' : '↓';
    return this.state.sort.length > 1 ? arrow + ' ' + (idx + 1) : arrow;
  },

  // data-state token for a header cell, so the skin can highlight a sorted column.
  columnSortState(key) {
    return this.sortState(key) === 'none' ? '' : 'sorted';
  },

  // — derived: rendering helpers ————————————————————————————————
  // Returned style object for a header cell width (gotcha: bind a method that
  // returns a real object, never an inline {…} literal in the expression).
  colStyle(col) {
    return col && col.width ? { width: col.width } : {};
  },

  isEmpty() {
    return !this.state.loading && !this.state.error && this.rows().length === 0;
  },

  // The aria-live announcement: loading / error / the range + selection count.
  liveMessage() {
    if (this.state.loading) return 'Loading';
    if (this.state.error) return 'Error: ' + this.state.error;
    const sel = this.selectedCount();
    const base = this.rangeLabel();
    return sel > 0 ? base + ', ' + sel + ' selected' : base;
  },

  // The rows an export draws from: the current selection if any, else the full
  // filtered set (in client mode that's every matching row across all pages; in
  // server mode it's whatever the host last handed us for this page).
  exportRows() {
    if (this.hasSelection()) {
      const keep = new Set(this.state.selected);
      return (this.state.server ? this.state.rows : this.filtered())
        .filter((row) => keep.has(row[this._rowKey]));
    }
    return this.state.server ? this.state.rows : this.filtered();
  },

  // Apply a column formatter to a value. format may be a function (value,row) or a
  // named string resolved by the formatters map; anything else is stringified.
  formatCell(col, value, row) {
    const fmt = col && col.format;
    if (typeof fmt === 'function') return String(fmt(value, row));
    if (typeof fmt === 'string') {
      const fn = this.formatters()[fmt];
      if (fn) return String(fn(value, row));
    }
    return value == null ? '' : String(value);
  },

  // Named formatters for columns seeded from JSON (which cannot carry a function).
  // Returned from a METHOD because a bare data property on the define object is
  // not wired to the instance.
  formatters() {
    return {
      currency: (v) =>
        v == null || v === ''
          ? ''
          : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(v)),
      number: (v) => (v == null || v === '' ? '' : new Intl.NumberFormat().format(Number(v))),
      date: (v) => {
        if (!v) return '';
        const d = new Date(v);
        return isNaN(d) ? String(v) : d.toLocaleDateString();
      },
    };
  },

  // — internals ————————————————————————————————————————————————
  _cellValue(row, col) {
    return row ? row[col.key] : undefined;
  },

  _pageStart() {
    // Server pages are zero-offset locally (the host already sliced); client pages
    // offset into the sorted set.
    return this.state.server ? 0 : (this.state.page - 1) * this.state.pageSize;
  },

  // The ids of the rows currently on screen — used by the tri-state header.
  _pageIds() {
    return this.rows().map((r) => r.id);
  },

  _clampPage(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return this.state.page;
    return Math.min(Math.max(Math.round(n), 1), this.pageCount());
  },

  // A type-aware comparator: numbers and dates compare numerically, everything
  // else compares as a locale-aware, case-insensitive string. Nullish sorts last.
  _compare(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const da = a instanceof Date ? a.getTime() : NaN;
    const db = b instanceof Date ? b.getTime() : NaN;
    if (!isNaN(da) && !isNaN(db)) return da - db;
    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
  },

  _range(start, end) {
    const out = [];
    for (let n = start; n <= end; n++) out.push(n);
    return out;
  },

  // Flatten the structured params into a query the backend can read. sort becomes
  // a compact "key:dir,key:dir" string; the rest pass through.
  _flatQuery(params) {
    return {
      sort: params.sort.map((s) => s.key + ':' + s.dir).join(','),
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  // CSV-escape a cell: wrap in quotes and double any inner quote when the value
  // contains a comma, quote, or newline (RFC 4180).
  _csvCell(value) {
    const s = value == null ? '' : String(value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  },

  // Trigger a browser download from an in-memory string. Object URL is revoked on
  // the next tick so the click has resolved.
  _download(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
});
