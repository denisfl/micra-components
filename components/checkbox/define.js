/*
 * components/checkbox/define.js — Checkbox group with a tri-state "select all"
 * (headless behavior).
 *
 * Pair with checkbox.css (default skin) and theme/theme.css (tokens). The markup
 * renders the boxes from state via data-each; this file owns the behavior:
 * per-item toggle, a "select all" control whose state is checked / mixed /
 * unchecked, disabled handling, and a 'change' event with the checked ids.
 *
 * Checkboxes are data-driven: state.options holds { id, label[, disabled] } and
 * state.checked is the array of checked ids. The shallow proxy means arrays are
 * never mutated in place — every change REPLACES state.checked. Counts and the
 * tri-state are methods, never state — state stays raw data only.
 *
 * Markup contract:
 *   <div class="micra-checkbox" data-component="checkbox">
 *     <span id="cb-label">…</span>
 *     <div role="group" aria-labelledby="cb-label">
 *       <button role="checkbox" data-state … @click="toggleAll"
 *               @keydown.space.prevent="toggleAll"
 *               data-bind="aria-checked:allState(), …">Select all</button>
 *       <template data-each="options" data-key="id"> … role="checkbox" … </template>
 *     </div>
 *   </div>
 *
 * Note: aria-checked is bound as a STRING ('true' | 'false' | 'mixed'), not a
 * boolean — a bare/boolean bind would set or drop the attribute, which is wrong
 * for an ARIA state value, and 'mixed' has no boolean equivalent at all.
 */
Micra.define('checkbox', {
  state: {
    options: [
      { id: 'read', label: 'Read' },
      { id: 'write', label: 'Write' },
      { id: 'delete', label: 'Delete' },
      { id: 'admin', label: 'Admin', disabled: true },
    ],
    checked: [],
  },

  // — per-item selection ————————————————————————————————————————
  toggle(id) {
    const option = this.state.options.find((o) => o.id === id);
    if (!option || option.disabled) return; // disabled items are not toggleable
    // Replace the array — the shallow proxy does not track in-place mutation.
    this.state.checked = this.isChecked(id)
      ? this.state.checked.filter((c) => c !== id)
      : [...this.state.checked, id];
    this.emit('change', this.state.checked); // the checked ids
  },

  // — select all ————————————————————————————————————————————————
  // If every enabled option is already checked, clear; otherwise check them all.
  // Disabled options are never added or removed by this control.
  toggleAll() {
    const enabled = this.enabledIds();
    this.state.checked = this.allChecked() ? [] : enabled;
    this.emit('change', this.state.checked);
  },

  // — derived (methods, never state) ——————————————————————————————
  isChecked(id) {
    return this.state.checked.includes(id);
  },

  enabledIds() {
    return this.state.options.filter((o) => !o.disabled).map((o) => o.id);
  },

  // How many enabled options are currently checked.
  checkedCount() {
    return this.enabledIds().filter((id) => this.isChecked(id)).length;
  },

  allChecked() {
    const enabled = this.enabledIds();
    return enabled.length > 0 && this.checkedCount() === enabled.length;
  },

  // The tri-state for the "select all" control, as an ARIA-ready STRING:
  // 'true' when every enabled option is checked, 'false' when none are, and
  // 'mixed' for the indeterminate in-between. The skin reads data-state, which
  // mirrors this as checked / mixed / unchecked.
  allState() {
    const count = this.checkedCount();
    if (count === 0) return 'false';
    if (this.allChecked()) return 'true';
    return 'mixed';
  },

  // data-state token for the select-all box (drives the check vs dash glyph).
  allDataState() {
    const state = this.allState();
    return state === 'true' ? 'checked' : state === 'mixed' ? 'mixed' : 'unchecked';
  },
});
