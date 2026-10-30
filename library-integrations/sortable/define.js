/*
 * library-integrations/sortable/define.js — SortableJS drag-reorder × Micra.
 *
 * A thin reactive wrapper around SortableJS (MIT, the plain-JS drag-and-drop
 * library — NOT a web component). Sortable owns the dragging; Micra owns the
 * order. The list is rendered from state via <template data-each="items"
 * data-key="id">, so state.items is the single source of truth — the visible
 * rank, the live "order" readout and the dirty / Save flag all react with no
 * extra wiring. Pair with sortable.css (token skin) and theme/theme.css (tokens).
 *
 * The integration pattern (same for every library wrapper):
 *   onCreate  — create the Sortable on the list ref, wire its onEnd into state.
 *   onDestroy — destroy the Sortable instance (no leaks across htmx/Astro swaps;
 *               Micra.autoCleanup() calls this when the island leaves the DOM).
 *
 * Markup contract (see index.html):
 *   <div data-component="sortable">
 *     <ul data-ref="list">
 *       <template data-each="items" data-key="id">
 *         <li>…$index + 1… …item.label…</li>
 *       </template>
 *     </ul>
 *     …your reactive UI bound to order() / isDirty() / save()…
 *   </div>
 *
 * ── THE STATE-SYNC PROBLEM (and the chosen fix) ───────────────────────────────
 * Two things want to move the same <li>:
 *   1. SortableJS physically moves the dragged node in the real DOM as you drop.
 *   2. Micra renders the list from state.items and reconciles keyed nodes.
 * If we only set state.items in onEnd, Micra's keyed reconciler diffs against a
 * DOM that Sortable has already mutated out from under it — the node Micra thinks
 * is at index N is no longer there. That mismatch is the classic desync / double-
 * move / flicker.
 *
 * The robust fix (implemented below): UNDO Sortable's DOM change *first*, putting
 * the dragged node back where it started, THEN write the reordered state.items.
 * Now Micra sees the DOM exactly as it last rendered it (its keyed bookkeeping is
 * valid), and Micra alone performs the reorder by reconciling keyed nodes to the
 * new state. One source of truth, no double-move. evt.from is the source list and
 * evt.from.children[evt.oldIndex] is the node now sitting at the drop slot, so
 * insertBefore puts evt.item back at its original index.
 */
Micra.define('sortable', {
  state: {
    // The ordered list — the single source of truth. Replaced (never mutated in
    // place) on every reorder, which schedules the keyed re-render.
    items: [],
    // Snapshot of the id order at the last "save", for the dirty flag.
    savedOrder: [],
  },

  onCreate() {
    this._list = this.refs.list;
    if (!this._list || typeof Sortable === 'undefined') return;

    // Optional seed: data-seed='[{"id":1,"label":"…"}, …]' on the root, loaded
    // once. Otherwise the host sets state.items before Micra.start().
    const seed = this.prop('seed');
    if (seed && this.state.items.length === 0) {
      try {
        const parsed = JSON.parse(seed);
        if (Array.isArray(parsed)) this.state.items = parsed;
      } catch (_) {
        /* ignore malformed seed */
      }
    }
    this.state.savedOrder = this.state.items.map((it) => it.id);

    this._sortable = Sortable.create(this._list, {
      animation: 150,
      handle: '[data-sortable-handle]', // grip only; omit to drag the whole row
      ghostClass: 'sortable-ghost', // the drop-placeholder slot
      chosenClass: 'sortable-chosen', // the lifted (picked-up) item
      dragClass: 'sortable-drag', // the moving clone under the cursor
      onEnd: (evt) => this._onEnd(evt),
    });
  },

  onDestroy() {
    if (this._sortable) this._sortable.destroy();
    this._sortable = null;
  },

  // — the drag → state bridge ——————————————————————————————————————
  _onEnd(evt) {
    const { oldIndex, newIndex } = evt;
    if (oldIndex === newIndex || oldIndex == null || newIndex == null) return;

    // STEP 1 — undo Sortable's DOM mutation so Micra is the only thing that
    // reorders. Move the dragged node back to its original slot in the source
    // list. After this, the DOM matches what Micra last rendered, so its keyed
    // reconciler has a valid baseline to diff against.
    evt.from.insertBefore(evt.item, evt.from.children[oldIndex]);

    // STEP 2 — reorder a *new* array (never mutate the state proxy in place) to
    // match the drag, then assign it. Writing state.items schedules the keyed
    // re-render; Micra moves the keyed <li> for us. No manual re-render.
    const items = [...this.state.items];
    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);
    this.state.items = items;

    // Hand the host the new order (ids, in rank order).
    this.emit('reorder', items.map((it) => it.id));
  },

  // — derived (methods, never state) ————————————————————————————
  // The current order as ids — used for the live readout and the dirty check.
  order() {
    return this.state.items.map((it) => it.id);
  },

  // Human-readable order line, e.g. "Ship · Docs · Tests".
  orderLabel() {
    return this.state.items.map((it) => it.label).join(' · ');
  },

  // Unsaved-changes flag — order differs from the last save.
  isDirty() {
    const a = this.order();
    const b = this.state.savedOrder;
    if (a.length !== b.length) return true;
    return a.some((id, i) => id !== b[i]);
  },

  // — actions ——————————————————————————————————————————————————
  // Snapshot the current order as "saved". A real app would PUT it here first;
  // the host can also listen to the 'save' event for the payload.
  save() {
    this.state.savedOrder = this.order();
    this.emit('save', this.state.savedOrder);
  },

  // Restore the saved order — replace state.items in the saved sequence. Micra
  // re-renders; if the Sortable is mid-state it stays in sync because state is
  // authoritative.
  reset() {
    const byId = new Map(this.state.items.map((it) => [it.id, it]));
    this.state.items = this.state.savedOrder.map((id) => byId.get(id)).filter(Boolean);
    this.emit('reorder', this.order());
  },
});
