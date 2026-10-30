/*
 * components/switch/define.js — Switch / Toggle (headless behavior).
 *
 * Pair with switch.css (default skin) and theme/theme.css (tokens). The markup
 * sets data-state via data-bind, so the skin slides a thumb across a track;
 * this file owns the behavior: toggle on click/Enter/Space, disabled handling,
 * and a 'change' event with the new boolean.
 *
 * Markup contract:
 *   <div data-component="switch" data-checked data-disabled>
 *     <button class="micra-switch" type="button" role="switch"
 *             data-bind="aria-checked:checked ? 'true' : 'false', aria-disabled:disabled ? 'true' : 'false',
 *                        data-state:checked ? 'checked' : 'unchecked'"
 *             @click="toggle" @keydown.space.prevent="toggle">
 *       <span class="micra-switch__thumb"></span>
 *     </button>
 *   </div>
 *
 * A native <button> already toggles on Enter and click; the keydown handler
 * adds Space and prevents the page from scrolling.
 */
Micra.define('switch', {
  state: { checked: false, disabled: false },

  onCreate() {
    // A bare data-checked / data-disabled (no value) reads back as '' from
    // prop(); treat anything that is not an explicit false (or absent) as true,
    // so both <button data-checked> and data-checked="true" enable the state.
    this.state.checked = this.prop('checked', false) !== false;
    this.state.disabled = this.prop('disabled', false) !== false;
  },

  toggle() {
    if (this.state.disabled) return; // no-op while disabled
    this.state.checked = !this.state.checked;
    this.emit('change', this.state.checked); // new boolean
  },

  // Derived label for binding the state into adjacent text (data-text="label").
  // A method, not a state field — it recomputes whenever checked changes.
  label() {
    return 'Notifications: ' + (this.state.checked ? 'on' : 'off');
  },
});
