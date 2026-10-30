/*
 * components/dropdown/define.js — Dropdown menu (headless behavior).
 *
 * A menu button (headless-ui Menu / react-aria MenuButton): a trigger that opens
 * a role="menu" popup of items. Pair with dropdown.css (default skin) and
 * theme/theme.css (tokens). The markup sets data-state via data-bind, so styling
 * reacts to open/closed; this file owns the behavior: open/close, roving
 * activedescendant (no real DOM focus moves between items), keyboard navigation,
 * selection, outside-click, focus return to the trigger.
 *
 * Markup contract (the root needs class="micra-dropdown" — its position:relative
 * is what anchors the absolutely-positioned menu under the trigger):
 *   <div class="micra-dropdown" data-component="dropdown" @pointerdown.outside="close">
 *     <button class="micra-dropdown__trigger" data-ref="trigger"
 *             aria-haspopup="menu" aria-controls="dropdown-menu"
 *             data-bind="aria-expanded:isOpen ? 'true' : 'false'"
 *             @click="toggle" @keydown.down.prevent="open" @keydown.up.prevent="open">…</button>
 *
 *     <ul class="micra-dropdown__menu" id="dropdown-menu" role="menu"
 *         data-ref="menu" tabindex="-1"
 *         data-bind="data-state:isOpen ? 'open' : 'closed', aria-activedescendant:activeDescendant()"
 *         @keydown.down.prevent="moveDown" @keydown.up.prevent="moveUp"
 *         @keydown.home.prevent="moveFirst" @keydown.end.prevent="moveLast"
 *         @keydown.enter.prevent="activate" @keydown.space.prevent="activate"
 *         @keydown.escape="close">
 *       <template data-each="items" data-key="id">
 *         <li class="micra-dropdown__item" role="menuitem"
 *             data-bind="id:item.id, aria-disabled:item.disabled ? 'true' : 'false',
 *                        data-state:isActive(item.id) ? 'active' : ''"
 *             @click="select(item.id)" data-text="item.label"></li>
 *       </template>
 *     </ul>
 *   </div>
 */
Micra.define('dropdown', {
  state: { isOpen: false, items: [], activeId: null, lastSelected: '' },



  toggle() {
    this.state.isOpen ? this.close() : this.open();
  },

  open() {
    if (this.state.isOpen) return;
    this._trigger = this.refs.trigger; // remember who opened it, to return focus
    this.state.activeId = this._firstEnabledId();
    this.state.isOpen = true;
    // Focus the menu container once it is actually visible. A double rAF waits
    // until the open styles have been applied (a single one can fire too early,
    // while the menu is still inheriting visibility:hidden, and focus() no-ops).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (this.refs.menu) this.refs.menu.focus();
      })
    );
  },

  close() {
    if (!this.state.isOpen) return;
    this.state.isOpen = false;
    this.state.activeId = null;
    if (this._trigger && this._trigger.focus) this._trigger.focus(); // return focus
  },

  // Activate the currently active item (Enter / Space).
  activate() {
    if (this.state.activeId != null) this.select(this.state.activeId);
  },

  // Choose an item: ignore disabled, emit, close, return focus to the trigger.
  select(id) {
    const item = this.state.items.find((i) => i.id === id);
    if (!item || item.disabled) return;
    this.state.lastSelected = item.label;
    this.emit('select', item);
    this.close();
  },

  // — keyboard navigation (roving aria-activedescendant, real focus stays put) —
  moveDown() { this._moveBy(1); },
  moveUp() { this._moveBy(-1); },

  moveFirst() {
    const enabled = this._enabled();
    if (enabled.length) this.state.activeId = enabled[0].id;
    this._scrollActiveIntoView();
  },

  moveLast() {
    const enabled = this._enabled();
    if (enabled.length) this.state.activeId = enabled[enabled.length - 1].id;
    this._scrollActiveIntoView();
  },

  // — derived values (methods, never state) ————————————————————
  isActive(id) {
    return this.state.activeId === id;
  },

  activeItemLabel() {
    const item = this.state.items.find((i) => i.id === this.state.activeId);
    return item ? item.label : '';
  },

  // aria-activedescendant value: the active item's DOM id, or '' to clear it.
  activeDescendant() {
    return this.state.activeId != null && this.state.isOpen ? String(this.state.activeId) : '';
  },

  // — internals ————————————————————————————————————————————————
  _enabled() {
    return this.state.items.filter((i) => !i.disabled);
  },

  _firstEnabledId() {
    const first = this._enabled()[0];
    return first ? first.id : null;
  },

  // Move the active item by step among enabled items, wrapping at the ends.
  _moveBy(step) {
    const enabled = this._enabled();
    if (!enabled.length) return;
    const current = enabled.findIndex((i) => i.id === this.state.activeId);
    const next = (current + step + enabled.length) % enabled.length;
    this.state.activeId = enabled[next].id;
    this._scrollActiveIntoView();
  },

  // Keep the active item visible when navigating a scrollable menu. A render is
  // scheduled on the activeId write; tick() resolves after it lands, so the
  // [data-state="active"] row exists by the time we scroll it into view.
  async _scrollActiveIntoView() {
    await this.tick();
    const el = this.$el.querySelector('[role="menuitem"][data-state="active"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  },
});
