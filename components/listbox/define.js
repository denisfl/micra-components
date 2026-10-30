/*
 * components/listbox/define.js — Listbox / custom select (headless behavior).
 *
 * A select-only combobox (WAI-ARIA "Select-Only Combobox" pattern; headless-ui
 * Listbox / react-aria Select): a button shows the chosen value and opens a
 * role="listbox" popup of options. It is the combobox without the text input.
 * Pair with listbox.css (default skin) and theme/theme.css (tokens). The markup
 * binds aria-* and data-state via data-bind, so styling and assistive tech react
 * to open/closed and the active option; this file owns the behavior: open/close,
 * keyboard navigation, selection, outside-click, focus return to the button.
 *
 * The active option is tracked by id (state.activeId), never by index, so the
 * highlight stays glued to the right row. Selection (state.value) is the
 * committed choice, shown on the button via selectedLabel().
 *
 * Markup contract (the root needs class="micra-listbox" — its position:relative
 * is what anchors the absolutely-positioned listbox under the button):
 *   <div class="micra-listbox" data-component="listbox" @pointerdown.outside="close">
 *     <button class="micra-listbox__button" role="combobox" aria-haspopup="listbox"
 *             aria-controls="lb-listbox" data-ref="button"
 *             data-bind="aria-expanded:open ? 'true' : 'false'"
 *             @click="toggle" @keydown.down.prevent="open" @keydown.up.prevent="open"
 *             @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle">
 *       <span data-text="selectedLabel()"></span></button>
 *
 *     <ul class="micra-listbox__list" id="lb-listbox" role="listbox" data-ref="list"
 *         tabindex="-1"
 *         data-bind="data-state:open ? 'open' : 'closed', aria-activedescendant:activeDescendant()"
 *         @keydown.down.prevent="next" @keydown.up.prevent="prev"
 *         @keydown.home.prevent="first" @keydown.end.prevent="last"
 *         @keydown.enter.prevent="choose" @keydown.space.prevent="choose"
 *         @keydown.escape="close"> … </ul>
 *   </div>
 */
Micra.define('listbox', {
  state: {
    options: [],
    value: null,    // id of the committed selection
    open: false,
    activeId: null, // id of the highlighted option (tracked by id, not index)
  },

  onCreate() {
    // Seed options from data-options (JSON array of {id,label[,disabled]}) if
    // provided. Replace the array wholesale — never push into it (state is a
    // shallow proxy). Default the selection to the first enabled option.
    const raw = this.prop('options');
    if (raw) this.state.options = JSON.parse(raw);

    // Optional: preselect a given id (data-value), or fall back to the first
    // enabled option when data-select-first is present. Default is no selection
    // (the button shows its placeholder).
    const initial = this.prop('value');
    if (initial !== '' && initial != null) this.state.value = initial;
    else if (this.prop('select-first', false) !== false) {
      this.state.value = this._firstEnabledId();
    }
  },


  // — derived (methods, never state) ————————————————————————————
  selectedLabel() {
    const opt = this.state.options.find((o) => o.id === this.state.value);
    return opt ? opt.label : '';
  },

  // The element id of the active option, for aria-activedescendant. Empty string
  // when nothing is active, so the attribute is effectively absent.
  activeDescendant() {
    return this.state.activeId == null || !this.state.open
      ? ''
      : this._optionId(this.state.activeId);
  },

  // — behavior ——————————————————————————————————————————————————
  toggle() {
    this.state.open ? this.close() : this.open();
  },

  open() {
    if (this.state.open) return;
    // Highlight the current selection, or the first enabled option.
    this.state.activeId = this.state.value != null && !this._isDisabled(this.state.value)
      ? this.state.value
      : this._firstEnabledId();
    this.state.open = true;
    // Focus the list once it is actually visible. A double rAF waits until the
    // open styles have been applied (a single one can fire too early, while the
    // list is still inheriting visibility:hidden, and focus() no-ops).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (this.refs.list) this.refs.list.focus();
        this._scrollActiveIntoView();
      })
    );
  },

  close() {
    if (!this.state.open) return;
    this.state.open = false;
    this.state.activeId = null;
    if (this.refs.button && this.refs.button.focus) this.refs.button.focus(); // return focus
  },

  next() {
    if (!this.state.open) { this.open(); return; }
    this.state.activeId = this._step(1);
    this._scrollActiveIntoView();
  },

  prev() {
    if (!this.state.open) { this.open(); return; }
    this.state.activeId = this._step(-1);
    this._scrollActiveIntoView();
  },

  first() {
    const enabled = this._enabled();
    if (enabled.length) this.state.activeId = enabled[0].id;
    this._scrollActiveIntoView();
  },

  last() {
    const enabled = this._enabled();
    if (enabled.length) this.state.activeId = enabled[enabled.length - 1].id;
    this._scrollActiveIntoView();
  },

  // Enter / Space commits the active option (if any).
  choose() {
    if (this.state.activeId != null) this.select(this.state.activeId);
  },

  // Choose an option: ignore disabled, set the value, emit, close, return focus.
  select(id) {
    const opt = this.state.options.find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    this.state.value = id;
    this.emit('change', opt);
    this.close();
  },

  // — internals ————————————————————————————————————————————————
  // Stable per-option element id, used for aria-activedescendant targeting.
  _optionId(id) {
    return 'lb-option-' + id;
  },

  _enabled() {
    return this.state.options.filter((o) => !o.disabled);
  },

  _firstEnabledId() {
    const first = this._enabled()[0];
    return first ? first.id : null;
  },

  _isDisabled(id) {
    const opt = this.state.options.find((o) => o.id === id);
    return !opt || !!opt.disabled;
  },

  // Next/prev enabled option id, wrapping. Resilient to the active id having
  // fallen out of the enabled set (then we land on the first enabled option).
  _step(dir) {
    const enabled = this._enabled();
    if (!enabled.length) return null;
    const i = enabled.findIndex((o) => o.id === this.state.activeId);
    if (i === -1) return enabled[0].id;
    const n = (i + dir + enabled.length) % enabled.length;
    return enabled[n].id;
  },

  // Keep the active option visible when navigating a scrollable list. A render is
  // scheduled on the activeId write; tick() resolves after it lands, so the
  // [data-state="active"] row exists by the time we scroll it into view.
  async _scrollActiveIntoView() {
    await this.tick();
    const el = this.$el.querySelector('[role="option"][data-state="active"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  },
});
