/*
 * components/popover/define.js — Popover (headless behavior).
 *
 * A non-modal anchored panel of arbitrary content (headless-ui Popover /
 * react-aria Popover): a trigger that opens a role="dialog" popup holding
 * whatever the consumer drops in (a form, a filter set, rich content). The
 * generic-content sibling of the dropdown — not a menu. Pair with popover.css
 * (default skin) and theme/theme.css (tokens). The markup sets data-state via
 * data-bind, so styling reacts to open/closed; this file owns the behavior:
 * open/close, Escape, outside-click, focus into the panel, focus return.
 *
 * Non-modal on purpose: no focus trap and no scroll lock. Tab moves through the
 * panel normally and may leave it — that is the difference from the modal.
 *
 * Markup contract (the root needs class="micra-popover" — its position:relative
 * is what anchors the absolutely-positioned panel under the trigger):
 *   <div class="micra-popover" data-component="popover" @pointerdown.outside="close">
 *     <button class="micra-popover__trigger" data-ref="trigger"
 *             aria-haspopup="dialog" aria-controls="popover-panel"
 *             data-bind="aria-expanded:isOpen ? 'true' : 'false'"
 *             @click="toggle">…</button>
 *
 *     <div class="micra-popover__panel" id="popover-panel" role="dialog"
 *          aria-labelledby="popover-title" data-ref="panel" tabindex="-1"
 *          data-bind="data-state:isOpen ? 'open' : 'closed'"
 *          @keydown.escape="close"> … </div>
 *   </div>
 */
Micra.define('popover', {
  state: { isOpen: false },



  toggle() {
    this.state.isOpen ? this.close() : this.open();
  },

  open() {
    if (this.state.isOpen) return;
    this._trigger = this.refs.trigger; // remember who opened it, to return focus
    this.state.isOpen = true;
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
    if (!this.state.isOpen) return;
    this.state.isOpen = false;
    if (this._trigger && this._trigger.focus) this._trigger.focus(); // return focus
  },

  // — internals ————————————————————————————————————————————————
  _focusables(root) {
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  },
});
