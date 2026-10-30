/*
 * components/tooltip/define.js — Tooltip (headless behavior).
 *
 * Pair with tooltip.css (default skin) and theme/theme.css (tokens). The markup
 * sets data-state via data-bind, so styling reacts to open/closed; this file
 * owns the behavior: an open delay on hover/focus, immediate hide on leave/blur,
 * and Escape to dismiss. No document listener is needed — Escape is handled by a
 * @keydown.escape on the wrapper, and the only side effect to clean up is the
 * pending open timer.
 *
 * Markup contract:
 *   <span data-component="tooltip" data-delay="400"
 *         @mouseenter="open" @mouseleave="close"
 *         @focusin="open" @focusout="close" @keydown.escape="close">
 *     <button aria-describedby="tip-1">…</button>
 *     <span class="micra-tooltip" id="tip-1" role="tooltip"
 *           data-bind="data-state:open ? 'open' : 'closed'">…</span>
 *   </span>
 */
Micra.define('tooltip', {
  state: { open: false },

  onDestroy() {
    clearTimeout(this._timer); // drop any pending open
  },

  open() {
    // Show after the open delay; remember the timer so leave/blur/Escape and
    // onDestroy can cancel it before it fires.
    clearTimeout(this._timer);
    const delay = this.prop('delay', 400); // auto-cast to a number
    this._timer = setTimeout(() => {
      this.state.open = true;
    }, delay);
  },

  close() {
    // Immediate: cancel any pending open and hide now.
    clearTimeout(this._timer);
    this.state.open = false;
  },
});
