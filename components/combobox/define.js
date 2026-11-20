/*
 * components/combobox/define.js — Combobox / autocomplete (headless behavior).
 *
 * Pair with combobox.css (default skin) and theme/theme.css (tokens). The markup
 * binds aria-* and data-state via data-bind, so styling and assistive tech react
 * to open/closed and the active option; this file owns the behavior: filtering,
 * keyboard navigation, selection, outside-click to close.
 *
 * The active option is tracked by id (state.activeId), never by index — so when
 * the filtered list changes under the user's fingers, the highlight can't drift
 * onto the wrong row. After every keystroke we re-validate activeId against the
 * current filtered() set and reset it if it fell out.
 *
 * Markup contract (see README / index.html):
 *   <div data-component="combobox" @pointerdown.outside="close">
 *     <input role="combobox" aria-autocomplete="list"
 *            data-bind="aria-expanded:open ? 'true' : 'false', aria-activedescendant:activeDescendant()"
 *            aria-controls="cb-listbox" data-model="query"
 *            @input="onInput" @focus="onFocus"
 *            @keydown.down.prevent="next" @keydown.up.prevent="prev"
 *            @keydown.enter.prevent="choose" @keydown.escape="close" @keydown.tab="close">
 *     <ul id="cb-listbox" role="listbox" data-bind="data-state:open ? 'open' : 'closed'"> … </ul>
 *   </div>
 */
Micra.define('combobox', {
  state: {
    options: [],
    query: '',
    open: false,
    activeId: null,   // id of the highlighted option (tracked by id, not index)
    selectedId: null, // id of the committed selection
  },

  onCreate() {
    // Seed options from data-options (JSON array of {id,label}) if provided.
    // Replace the array wholesale — never push into it (state is a shallow proxy).
    // An array default parses the JSON; an absent attribute keeps what's in state.
    const options = this.prop('options', []);
    if (options.length) this.state.options = options;
  },


  // — derived (methods, never state) ————————————————————————————
  filtered() {
    const q = this.state.query.trim().toLowerCase();
    if (!q) return this.state.options;
    return this.state.options.filter((o) => o.label.toLowerCase().includes(q));
  },

  noResults() {
    return this.filtered().length === 0;
  },

  // The element id of the active option, for aria-activedescendant. Empty string
  // when nothing is active, so the attribute is effectively absent.
  activeDescendant() {
    return this.state.activeId == null ? '' : this._optionId(this.state.activeId);
  },

  selectedLabel() {
    const opt = this.state.options.find((o) => o.id === this.state.selectedId);
    return opt ? opt.label : '';
  },

  // — behavior ——————————————————————————————————————————————————
  onFocus() {
    this.open();
  },

  // Fires on every keystroke. data-model also updates state.query from this same
  // event, but the two listeners' order isn't guaranteed — so we set query from
  // the event ourselves before recomputing, guaranteeing the highlighted option
  // matches the freshly filtered list the user sees. Reset to the first match.
  onInput(e) {
    this.state.query = e.target.value;
    this.state.open = true;
    this.state.activeId = this._firstId();
  },

  open() {
    if (this.state.open) return;
    this.state.open = true;
    if (this.state.activeId == null) this.state.activeId = this._firstId();
  },

  close() {
    if (!this.state.open) return;
    this.state.open = false; // keeps the typed text and input focus
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

  // Enter commits the active option (if any). Bound to @keydown.enter.
  choose() {
    if (this.state.activeId != null) this.select(this.state.activeId);
  },

  select(id) {
    const opt = this.state.options.find((o) => o.id === id);
    if (!opt) return;
    this.state.selectedId = id;
    this.state.query = opt.label;
    this.state.activeId = id;
    this.state.open = false;
    this.emit('change', opt);
  },

  setActive(id) {
    this.state.activeId = id; // hover follows the pointer
  },

  // — internals ————————————————————————————————————————————————
  // Stable per-option element id, used for aria-activedescendant targeting.
  _optionId(id) {
    return 'cb-option-' + id;
  },

  _firstId() {
    const f = this.filtered();
    return f.length ? f[0].id : null;
  },

  // Next/prev option id within filtered(), wrapping. Resilient to the active id
  // having fallen out of the filtered set (then we land on the first option).
  _step(dir) {
    const f = this.filtered();
    if (!f.length) return null;
    const i = f.findIndex((o) => o.id === this.state.activeId);
    if (i === -1) return f[0].id;
    const n = (i + dir + f.length) % f.length;
    return f[n].id;
  },

  // Keep the highlighted option visible when navigating a scrollable listbox.
  // A render is scheduled on the activeId write; tick() resolves after it lands, so the
  // [data-state="active"] row exists by the time we scroll it into view.
  async _scrollActiveIntoView() {
    await this.tick();
    const el = this.$el.querySelector('[role="option"][data-state="active"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  },
});
