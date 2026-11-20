/*
 * components/dropdown/define.js — Dropdown menu (headless behavior) on the
 * native Popover API.
 *
 * A menu button (headless-ui Menu / react-aria MenuButton): a trigger that opens
 * a role="menu" popup of items. Pair with dropdown.css (default skin) and
 * theme/theme.css (tokens). The browser owns opening on click, closing on an
 * outside click or Escape, and the top layer (popovertarget + popover). This file
 * mirrors that into `isOpen`, moves focus, runs the roving activedescendant
 * (no real DOM focus moves between items), keyboard navigation and selection.
 *
 * Placement: CSS anchor positioning in the skin. Where the browser lacks it,
 * _place() sets top/left from the trigger's box and follows scroll and resize.
 *
 * Markup contract:
 *   <micra-dropdown>
 *     <button class="micra-dropdown__trigger" data-ref="trigger"
 *             popovertarget="dropdown-menu" aria-haspopup="menu"
 *             data-bind="aria-expanded:isOpen ? 'true' : 'false'"
 *             @keydown.down.prevent="open" @keydown.up.prevent="open">…</button>
 *
 *     <ul class="micra-dropdown__menu" id="dropdown-menu" role="menu" popover
 *         data-ref="menu" tabindex="-1" @toggle="onToggle"
 *         data-bind="aria-activedescendant:activeDescendant()"
 *         @keydown.down.prevent="moveDown" @keydown.up.prevent="moveUp"
 *         @keydown.home.prevent="moveFirst" @keydown.end.prevent="moveLast"
 *         @keydown.enter.prevent="activate" @keydown.space.prevent="activate">
 *       <template data-each="items" data-key="id">
 *         <li class="micra-dropdown__item" role="menuitem"
 *             data-bind="id:item.id, aria-disabled:item.disabled ? 'true' : 'false',
 *                        data-state:isActive(item.id) ? 'active' : ''"
 *             @click="select(item.id)" data-text="item.label"></li>
 *       </template>
 *     </ul>
 *   </micra-dropdown>
 */
Micra.define('dropdown', {
  state: { isOpen: false, items: [], activeId: null, lastSelected: '' },



  onCreate() {
    // A unique anchor name per instance, so several dropdowns on a page each
    // attach their menu to their own trigger.
    const name = '--micra-dropdown-' + Math.random().toString(36).slice(2);
    this.refs.trigger.style.anchorName = name;
    this.refs.menu.style.positionAnchor = name;
  },

  toggle() {
    this.refs.menu.togglePopover();
  },

  open() {
    if (!this.state.isOpen) this.refs.menu.showPopover();
  },

  close() {
    if (this.state.isOpen) this.refs.menu.hidePopover();
  },

  // The popover opened or closed: by the trigger, an outside click, Escape,
  // or open()/close().
  onToggle(e) {
    const menu = this.refs.menu;
    if (e.newState === 'open') {
      this.state.activeId = this._firstEnabledId();
      this.state.isOpen = true;
      this._place();
      menu.focus();
    } else {
      this.state.isOpen = false;
      this.state.activeId = null;
      if (this._unfollow) this._unfollow();
      // Return focus to the trigger, unless the user clicked somewhere else.
      const a = document.activeElement;
      if (!a || a === document.body || menu.contains(a)) this.refs.trigger.focus();
    }
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

  // Without CSS anchor positioning, put the menu under the trigger by hand and
  // keep it there while the page scrolls or resizes.
  _place() {
    if (CSS.supports('position-anchor: --a')) return;
    const follow = () => {
      const r = this.refs.trigger.getBoundingClientRect();
      this.refs.menu.style.top = r.bottom + 'px'; // the skin's margin adds the gap
      this.refs.menu.style.left = r.left + 'px';
    };
    follow();
    const offScroll = this.listen(window, 'scroll', follow, true);
    const offResize = this.listen(window, 'resize', follow);
    this._unfollow = () => (offScroll(), offResize(), (this._unfollow = null));
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
