/*
 * components/modal/define.js — Modal (headless behavior).
 *
 * Pair with modal.css (default skin) and theme/theme.css (tokens). The markup
 * sets data-state via data-bind, so styling reacts to open/closed; this file
 * owns the behavior: open/close, Escape, focus trap, focus return, scroll lock.
 *
 * Markup contract:
 *   <div data-component="modal" @keydown.escape.window="close" @keydown.tab.window="trapTab" data-title="…">
 *     <button @click="open">…</button>
 *     <div class="micra-modal" data-bind="data-state:isOpen ? 'open' : 'closed'" @click.self="close">
 *       <div class="micra-modal__dialog" role="dialog" aria-modal="true"
 *            data-ref="dialog" tabindex="-1"> … <button @click="close">…</button> </div>
 *     </div>
 *   </div>
 */
Micra.define('modal', {
  state: { isOpen: false, title: '' },

  onCreate() {
    this.state.title = this.prop('title') || 'Dialog';
  },

  onDestroy() {
    this._setScrollLock(false);
  },

  open() {
    this._trigger = document.activeElement; // remember who opened it
    this.state.isOpen = true;
    this._setScrollLock(true);
    // Move focus into the dialog once it is actually visible. A double rAF waits
    // until the open styles have been applied (a single one can fire too early,
    // while the dialog is still inheriting visibility:hidden, and focus() no-ops).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const dialog = this.refs.dialog;
        if (dialog) (this._focusables(dialog)[0] || dialog).focus();
      })
    );
  },

  close() {
    if (!this.state.isOpen) return;
    this.state.isOpen = false;
    this._setScrollLock(false);
    if (this._trigger && this._trigger.focus) this._trigger.focus(); // return focus
  },

  // — internals ————————————————————————————————————————————————
  // Called from the root's @keydown.tab.window; a no-op while closed.
  trapTab(e) {
    if (!this.state.isOpen) return;
    const dialog = this.refs.dialog;
    if (!dialog) return;
    const f = this._focusables(dialog);
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
