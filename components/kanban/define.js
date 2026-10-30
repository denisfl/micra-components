/*
 * components/kanban/define.js — Kanban (headless behavior).
 *
 * A drag-and-drop board with money in it: columns hold cards, each card carries a
 * value, and the board sums per-column totals plus a board forecast. Pair with
 * kanban.css (default skin) and theme/theme.css (tokens). The markup renders a
 * horizontal row of columns from columnsView() via nested data-each; this file
 * owns everything else: pointer drag-and-drop, a keyboard move path that does the
 * same thing without a mouse, WIP limits, totals, and ARIA announcements.
 *
 * State is a SHALLOW proxy — arrays/objects are REPLACED, never mutated in place.
 * Every move rebuilds the WHOLE state.columns array (remove the card from its
 * source column, insert it into the target at an index) and REPLACES the top-level
 * property; there are no nested-path writes. state stays the single source of
 * truth — the DOM is queried only for geometry (card rectangles) to decide the
 * drop index, never to read or hold data.
 *
 * The view shape (columnsView()):
 *   [ { id, title, wip, total, count, over, accent, dropping,
 *       cards: [ { id, title, value, meta, columnId } ] } ]
 * Cards are PRE-FLATTENED with their columnId. Micra names every data-each scope
 * variable `item`, so the OUTER item is the column and the INNER data-each
 * (column.cards) rebinds `item` to each card — the card loop cannot reach back to
 * the column. Pre-flattening columnId onto every card means a card template has
 * card.columnId without reaching the outer scope (so @dragstart and the keyboard
 * controls know which column a card lives in). The per-column total/count/over
 * flags are baked in too, so headers read straight off the view.
 *
 * DRAG-AND-DROP is the HTML5 API (@dragstart/@dragover/@drop/@dragend). On drag
 * over a column we measure the not-being-dragged card rectangles in that column
 * and compare the pointer Y to each midpoint to find the insert index; that index
 * plus the hovered column id live in state.drag, which drives the placeholder. On
 * drop we MOVE the card and emit('move'). Keyboard moves (moveCard) reuse the very
 * same immutable _move() — so the whole reordering core is testable by direct
 * calls even where pointer DnD is hard to drive headlessly.
 */
Micra.define('kanban', {
  state: {
    // columns: [{ id, title, wip?, cards: [{ id, title, value?, meta? }] }]
    columns: [],
    // The in-flight drag, or null. { cardId, from, over, index } — `over` is the
    // column being hovered, `index` the computed insert position within it.
    drag: null,
    // The last move, phrased for the aria-live region. '' until the first move.
    announce: '',
  },

  onCreate() {
    // Seed the board from a data-columns JSON attribute. prop() hands back the raw
    // string; parse it defensively and REPLACE the array (shallow proxy).
    const columns = this._parseJSON(this.prop('columns'));
    if (Array.isArray(columns)) this.state.columns = columns;
  },

  onDestroy() {
    // Clear the announce-debounce timer if a move is still pending its echo.
    if (this._announceTimer) clearTimeout(this._announceTimer);
  },

  // — public API ————————————————————————————————————————————————
  // Host entry point: replace the whole board. Arrays are REPLACED, not mutated.
  setColumns(columns) {
    this.state.columns = Array.isArray(columns) ? columns : [];
  },

  // — pointer drag-and-drop ————————————————————————————————————
  // A card began dragging. Remember which card and its source column; seed the
  // drag with no target yet. dataTransfer is set so native DnD is happy.
  onDragStart(cardId, columnId, e) {
    this.state.drag = { cardId, from: columnId, over: null, index: null };
    if (e && e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Some browsers require data to be set for a drag to start at all.
      try { e.dataTransfer.setData('text/plain', String(cardId)); } catch (_) {}
    }
  },

  // Hovering a column (the handler is on the column, so it fires for the column
  // and bubbles up from the cards inside it). .prevent in the markup lets us be a
  // drop target. Compute the insert index from pointer geometry and REPLACE drag.
  onDragOver(columnId, e) {
    if (!this.state.drag) return;
    const index = this._dropIndex(columnId, e);
    const d = this.state.drag;
    // Only rewrite state when the target actually changed — avoids a render storm
    // as dragover fires continuously.
    if (d.over === columnId && d.index === index) return;
    this.state.drag = { ...d, over: columnId, index };
  },

  // Dropped on a column. Move the dragged card into it at the computed index, emit
  // 'move', announce it, and clear the drag.
  onDrop(columnId, e) {
    const d = this.state.drag;
    if (!d) return;
    const index = this._dropIndex(columnId, e);
    this._move(d.cardId, columnId, index);
    this.state.drag = null;
  },

  // Drag ended (dropped anywhere, or cancelled). Clear any lingering drag state so
  // the placeholder disappears even on an aborted drag outside every column.
  onDragEnd() {
    if (this.state.drag) this.state.drag = null;
  },

  // — keyboard moves ————————————————————————————————————————————
  // The mouse-free path. dir is 'left' | 'right' (change column, keep vertical
  // slot) or 'up' | 'down' (reorder within the column). Reuses _move(), so it is
  // exactly the same immutable rebuild the pointer drop performs. Returns true if
  // anything moved — handy for tests and for swallowing the key only when used.
  moveCard(cardId, dir) {
    const loc = this._locate(cardId);
    if (!loc) return false;
    const { colIndex, cardIndex } = loc;
    const cols = this.state.columns;

    if (dir === 'up' || dir === 'down') {
      const last = cols[colIndex].cards.length - 1;
      if (dir === 'up' && cardIndex === 0) return false;
      if (dir === 'down' && cardIndex === last) return false;
      // _move reads `target` as a pre-removal insert index and shifts it down by
      // one for a same-column move past the original slot. So to land one slot UP
      // we ask for cardIndex - 1 (no shift, target < cardIndex); to land one slot
      // DOWN we ask for cardIndex + 2 (shift makes it cardIndex + 1 post-removal).
      const target = dir === 'up' ? cardIndex - 1 : cardIndex + 2;
      return this._move(cardId, cols[colIndex].id, target);
    }

    if (dir === 'left' || dir === 'right') {
      const toCol = dir === 'left' ? colIndex - 1 : colIndex + 1;
      if (toCol < 0 || toCol >= cols.length) return false;
      // Keep the same vertical slot where possible (clamped to the new column's
      // length, since the card is inserted, not swapped).
      const target = Math.min(cardIndex, cols[toCol].cards.length);
      return this._move(cardId, cols[toCol].id, target);
    }

    return false;
  },

  // Keydown on a focused card. Arrow keys move it; we only preventDefault when a
  // move actually happened, so unhandled keys keep their native behavior. After a
  // successful move we re-focus the card in its new home (see _refocus()).
  onCardKey(cardId, e) {
    if (!e) return;
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const dir = map[e.key];
    if (!dir) return;
    if (this.moveCard(cardId, dir)) {
      e.preventDefault();
      this._refocus(cardId);
    }
  },

  // — derived: the view ————————————————————————————————————————
  // The single render source. Each column is flattened to header-ready fields
  // (total, count, over) and each card carries its columnId so the nested card
  // template never reaches the outer scope. `dropping` flags the column the drag
  // is currently over so the skin can show a drop zone.
  columnsView() {
    const drag = this.state.drag;
    return this.state.columns.map((col) => ({
      id: col.id,
      title: col.title,
      wip: col.wip != null ? col.wip : null,
      total: this.columnTotal(col.id),
      count: this.cardCount(col),
      over: this.isOverWip(col),
      accent: this._accentStyle(col),
      dropping: !!(drag && drag.over === col.id),
      // Spread the card so domain fields (contact, company, tags, … on a card)
      // reach the card template, then normalize the built-ins the default skin
      // relies on. Backward-compatible: id/title/value/meta still present.
      cards: (col.cards || []).map((card) => ({
        ...card,
        value: card.value != null ? card.value : null,
        valueLabel: this.money(card.value),
        meta: card.meta != null ? card.meta : '',
        columnId: col.id,
      })),
    }));
  },

  // — derived: totals / forecast / WIP ——————————————————————————
  // Sum of card values in one column. Missing values count as zero.
  columnTotal(colId) {
    const col = this.state.columns.find((c) => c.id === colId);
    if (!col || !col.cards) return 0;
    return col.cards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
  },

  // The board forecast: the sum of every card value across every column. (A
  // weighted pipeline forecast would multiply each column's total by a win
  // probability — left as a host concern; this is the straight sum.)
  forecast() {
    return this.state.columns.reduce((sum, col) => sum + this.columnTotal(col.id), 0);
  },

  // How many cards a column holds.
  cardCount(col) {
    return col && col.cards ? col.cards.length : 0;
  },

  // True when a column declares a WIP limit and is over it.
  isOverWip(col) {
    return !!(col && col.wip != null && this.cardCount(col) > col.wip);
  },

  // Currency string for a value, or '' when absent. Distinct name from any state
  // key so it always resolves to the method in markup.
  money(value) {
    if (value == null || value === '') return '';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  },

  // The forecast, formatted — for the board summary.
  forecastLabel() {
    return this.money(this.forecast());
  },

  // A card's value for the accessible name: the currency string, or "no value".
  // Takes a view card (carries valueLabel). Distinct from money() so the label
  // never reads an empty string.
  valueOrDash(card) {
    return card && card.value != null ? card.valueLabel : 'no value';
  },

  // "3 / 5" when a WIP limit is set, else just the count. Reads off a view column.
  wipLabel(col) {
    if (!col) return '';
    return col.wip != null ? col.count + ' / ' + col.wip : String(col.count);
  },

  // The accessible name for a column region: "Proposal (3)".
  columnLabel(col) {
    return col ? col.title + ' (' + col.count + ')' : '';
  },

  // — derived: drag indicators ——————————————————————————————————
  // data-state token for a column: 'over' while the drag hovers it (drives the
  // drop-zone highlight), else ''.
  columnState(col) {
    return col && col.dropping ? 'over' : '';
  },

  // True when the drop placeholder should sit BEFORE the card at `index` in the
  // given column — i.e. the live drag is over this column and its computed insert
  // index lands here. Used to render the placeholder between cards.
  showPlaceholderAt(columnId, index) {
    const d = this.state.drag;
    return !!(d && d.over === columnId && d.index === index);
  },

  // True when the placeholder belongs at the very END of a column (insert index ==
  // card count). Kept separate so the template can drop a trailing placeholder.
  showPlaceholderEnd(col) {
    const d = this.state.drag;
    return !!(d && col && d.over === col.id && d.index === col.cards.length);
  },

  // The live-region text, announced politely after each move.
  liveMessage() {
    return this.state.announce;
  },

  // — internals ————————————————————————————————————————————————
  // The core immutable move, shared by drop and keyboard. Remove the card from its
  // source column, insert it into the target at `index` (clamped), and REPLACE the
  // whole state.columns array. Returns false (no state write) when nothing changes.
  _move(cardId, toColId, index) {
    const loc = this._locate(cardId);
    if (!loc) return false;
    const cols = this.state.columns;
    const fromCol = cols[loc.colIndex];
    const toColIndex = cols.findIndex((c) => c.id === toColId);
    if (toColIndex === -1) return false;

    const card = fromCol.cards[loc.cardIndex];
    const sameColumn = fromCol.id === toColId;

    // Clamp the insert index. When moving within the same column, account for the
    // card being removed first: a target past the original slot shifts down by one.
    let target = Number(index);
    if (!Number.isFinite(target)) target = cols[toColIndex].cards.length;
    if (sameColumn && target > loc.cardIndex) target -= 1;

    // No-op guard: same column, same resulting slot.
    if (sameColumn && target === loc.cardIndex) return false;

    // Rebuild every column immutably. Source loses the card; target gains it at the
    // clamped index. Other columns pass through unchanged (still new array refs is
    // unnecessary — only the two touched columns are rebuilt).
    const next = cols.map((col) => {
      if (col.id === fromCol.id && col.id === toColId) {
        // Same column: remove then insert in one rebuilt cards array.
        const cards = fromCol.cards.filter((_, i) => i !== loc.cardIndex);
        const bounded = Math.min(Math.max(target, 0), cards.length);
        cards.splice(bounded, 0, card);
        return { ...col, cards };
      }
      if (col.id === fromCol.id) {
        return { ...col, cards: fromCol.cards.filter((_, i) => i !== loc.cardIndex) };
      }
      if (col.id === toColId) {
        const cards = [...col.cards];
        const bounded = Math.min(Math.max(target, 0), cards.length);
        cards.splice(bounded, 0, card);
        return { ...col, cards };
      }
      return col;
    });

    this.state.columns = next;
    this._afterMove(card, fromCol, cols[toColIndex]);
    return true;
  },

  // Post-move side effects: emit for the host and announce for screen readers.
  _afterMove(card, fromCol, toCol) {
    const finalCol = this.state.columns.find((c) => c.id === toCol.id);
    const finalIndex = finalCol ? finalCol.cards.findIndex((c) => c.id === card.id) : -1;
    this.emit('move', {
      cardId: card.id,
      from: fromCol.id,
      to: toCol.id,
      index: finalIndex,
    });
    this.state.announce =
      'Moved ' + (card.title || card.id) + ' to ' + toCol.title +
      ', position ' + (finalIndex + 1) + '.';
  },

  // Find a card's column index + card index within the live state, or null.
  _locate(cardId) {
    const cols = this.state.columns;
    for (let colIndex = 0; colIndex < cols.length; colIndex++) {
      const cards = cols[colIndex].cards || [];
      const cardIndex = cards.findIndex((c) => c.id === cardId);
      if (cardIndex !== -1) return { colIndex, cardIndex };
    }
    return null;
  },

  // Compute the insert index in a column from the pointer Y. The DOM is consulted
  // for GEOMETRY ONLY: we query the cards rendered in the hovered column, skip the
  // one being dragged, and count how many sit above the pointer's midpoint. State
  // stays the source of truth — this returns a plain integer.
  _dropIndex(columnId, e) {
    const list = this.$el.querySelector(
      '[data-col-list][data-col-id="' + this._cssEscape(columnId) + '"]'
    );
    if (!list || !e) {
      const col = this.state.columns.find((c) => c.id === columnId);
      return col ? col.cards.length : 0;
    }
    const draggingId = this.state.drag ? this.state.drag.cardId : null;
    const cards = Array.from(list.querySelectorAll('[data-card-id]')).filter(
      (el) => String(el.getAttribute('data-card-id')) !== String(draggingId)
    );
    const y = e.clientY;
    let index = 0;
    for (const el of cards) {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (y < mid) break;
      index++;
    }
    return index;
  },

  // After a keyboard move the DOM is rebuilt, so the old card node is gone; restore
  // focus to the card's fresh node once the render has landed.
  async _refocus(cardId) {
    await this.tick();
    const el = this.$el.querySelector(
      '[data-card-id="' + this._cssEscape(cardId) + '"]'
    );
    if (el) el.focus();
  },

  // The per-column accent bar, as a returned style OBJECT (gotcha: an inline {…}
  // literal in an expression does not work — a method must return the object). The
  // bar fills proportionally to this column's share of the board forecast.
  _accentStyle(col) {
    const total = this.forecast();
    const share = total > 0 ? Math.round((this.columnTotal(col.id) / total) * 100) : 0;
    return { width: share + '%' };
  },

  // prop() hands back the raw JSON string for data-columns; parse defensively so a
  // malformed attribute does not crash the component.
  _parseJSON(raw) {
    if (raw == null || raw === '' || typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  // Escape an id for use inside an attribute selector. CSS.escape where available
  // (ids may be numbers-as-strings or contain odd characters); a safe fallback
  // otherwise.
  _cssEscape(value) {
    const s = String(value);
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
    return s.replace(/["\\\]]/g, '\\$&');
  },
});
