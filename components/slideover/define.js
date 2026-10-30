/*
 * components/slideover/define.js — Slide-over / drawer (headless behavior).
 *
 * A modal side drawer: same mechanics as the modal (focus trap, focus return,
 * Escape, backdrop click, body scroll lock), but the panel slides in from an
 * edge instead of centering. Pair with slideover.css (default skin) and
 * theme/theme.css (tokens). The markup sets data-state via data-bind, so styling
 * reacts to open/closed; this file owns the behavior.
 *
 * Two data-* props on the root drive position:
 *   data-side="right|left|top|bottom"  (default "right")
 *   data-size="24rem"                  (optional; the skin has a sensible default)
 * Both are mirrored onto the overlay/panel as a data-side attribute the skin uses
 * to pick the edge and the slide transform, and as a --micra-slideover-size
 * custom property when a size is given.
 *
 * Markup contract:
 *   <div data-component="slideover" @keydown.escape.window="close" @keydown.tab.window="trapTab" data-side="right" data-size="24rem">
 *     <button @click="open">…</button>
 *     <div class="micra-slideover"
 *          data-bind="data-state:open ? 'open' : 'closed', data-side:side()"
 *          @click.self="close">
 *       <div class="micra-slideover__panel" role="dialog" aria-modal="true"
 *            aria-labelledby="…" data-ref="panel" tabindex="-1"
 *            data-bind="data-side:side(), style:panelStyle()"> … </div>
 *     </div>
 *   </div>
 */
Micra.define('slideover', {
  state: { open: false },


  onDestroy() {
    this._setScrollLock(false); // never leave the body locked
  },

  // — derived (methods, not state) ——————————————————————————————
  // Edge the panel docks to. prop() returns the string; default "right".
  side() {
    const s = this.prop('side', 'right');
    return s === 'left' || s === 'top' || s === 'bottom' ? s : 'right';
  },

  // Optional explicit size → the custom property the skin reads (width for
  // left/right, height for top/bottom). Returned as a style *string*, not an
  // object: data-bind's object branch uses Object.assign, which silently drops
  // custom properties (`--foo`); the string branch goes through setAttribute,
  // which sets them. Empty string clears it and lets the skin default apply.
  panelStyle() {
    const size = this.prop('size');
    return size ? `--micra-slideover-size: ${size}` : '';
  },

  // — actions ——————————————————————————————————————————————————
  open() {
    this._trigger = document.activeElement; // remember who opened it
    this.state.open = true;
    this._setScrollLock(true);
    // Move focus into the panel once it is actually visible. A double rAF waits
    // until the open styles have been applied (a single one can fire too early,
    // while the panel is still inheriting visibility:hidden, and focus() no-ops).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const panel = this.refs.panel;
        if (panel) (this._focusables(panel)[0] || panel).focus();
      })
    );
  },

  close() {
    if (!this.state.open) return;
    this.state.open = false;
    this._setScrollLock(false);
    if (this._trigger && this._trigger.focus) this._trigger.focus(); // return focus
  },

  // — internals ————————————————————————————————————————————————
  // Called from the root's @keydown.tab.window; a no-op while closed.
  trapTab(e) {
    if (!this.state.open) return;
    const panel = this.refs.panel;
    if (!panel) return;
    const f = this._focusables(panel);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  },

  _focusables(root) {
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  },

  _setScrollLock(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  },
});
