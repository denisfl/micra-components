/*
 * components/radiogroup/define.js — Radio group (headless behavior).
 *
 * Pair with radiogroup.css (default skin) and theme/theme.css (tokens). The
 * markup renders the radios from state via data-each; this file owns the
 * behavior: single selection, roving tabindex, arrow/Home/End keyboard, and
 * automatic activation (selecting a radio also moves real focus to it).
 *
 * Radios are data-driven: state.options holds
 * { id, label[, description][, disabled] } and state.value is the selected id.
 * Selection logic and the prev/next lookups are methods, never state — state
 * stays raw data only.
 *
 * Markup contract:
 *   <div data-component="radiogroup">
 *     <span id="rg-label">…</span>
 *     <div role="radiogroup" aria-labelledby="rg-label"
 *          @keydown.down.prevent="next" @keydown.up.prevent="prev" …>
 *       <template data-each="options" data-key="id"> … role="radio" … </template>
 *     </div>
 *   </div>
 */
Micra.define('radiogroup', {
  state: {
    options: [
      { id: 'free', label: 'Free', description: 'For hobby projects and trying things out.' },
      { id: 'pro', label: 'Pro', description: 'For individuals shipping production work.' },
      { id: 'team', label: 'Team', description: 'Shared billing and roles.', disabled: true },
      { id: 'enterprise', label: 'Enterprise', description: 'SSO, audit logs, priority support.' },
    ],
    value: '',
  },

  onCreate() {
    // Default selection: the first enabled option. Done here, not as a state
    // literal, so a host can hand in options/value and we still fall back well.
    if (!this.selectedOption()) this.state.value = this.firstEnabledId();
  },

  // — selection ————————————————————————————————————————————————
  select(id) {
    const option = this.state.options.find((o) => o.id === id);
    if (!option || option.disabled) return; // disabled options are not selectable
    this.state.value = id;
    this.emit('change', option); // the newly selected option
    this.focusSelected();
  },

  prev() {
    this.select(this.adjacentEnabledId(-1));
  },

  next() {
    this.select(this.adjacentEnabledId(1));
  },

  first() {
    this.select(this.firstEnabledId());
  },

  last() {
    const enabled = this.enabledOptions();
    if (enabled.length) this.select(enabled[enabled.length - 1].id);
  },

  // Space selects the focused radio. We resolve the focused id from the DOM
  // (the element that received the keydown), then run normal selection.
  selectFocused(e) {
    const radio = e.target.closest('[role="radio"]');
    if (radio) this.select(radio.dataset.id);
  },

  // — derived (methods, never state) ——————————————————————————————
  selectedOption() {
    return this.state.options.find((o) => o.id === this.state.value);
  },

  enabledOptions() {
    return this.state.options.filter((o) => !o.disabled);
  },

  firstEnabledId() {
    const first = this.enabledOptions()[0];
    return first ? first.id : '';
  },

  // The enabled option `step` positions away from the current one, wrapping.
  // Walks the full ring so we skip over any disabled options in between.
  adjacentEnabledId(step) {
    const options = this.state.options;
    const n = options.length;
    if (!n) return '';
    let i = options.findIndex((o) => o.id === this.state.value);
    if (i < 0) i = 0;
    for (let hops = 0; hops < n; hops++) {
      i = (i + step + n) % n;
      if (!options[i].disabled) return options[i].id;
    }
    return this.state.value; // all others disabled — stay put
  },

  // — focus ————————————————————————————————————————————————————
  // Automatic activation: after a selection re-renders, move real focus to the
  // newly selected radio. We only query the DOM for the focus target — the
  // source of truth stays in state. tick() waits for the re-render (and the new
  // roving tabindex) before focus() runs.
  async focusSelected() {
    await this.tick();
    const radio = this.$el.querySelector('[role="radio"][aria-checked="true"]');
    if (radio) radio.focus();
  },
});
