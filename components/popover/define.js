/*
 * components/popover/define.js — Popover (headless behavior) on the native
 * Popover API.
 *
 * A non-modal anchored panel of arbitrary content (headless-ui Popover /
 * react-aria Popover): a trigger that opens a role="dialog" popup holding
 * whatever the consumer drops in (a form, a filter set, rich content). The
 * generic-content sibling of the dropdown — not a menu. Pair with popover.css
 * (default skin) and theme/theme.css (tokens). The browser owns opening on
 * click, closing on an outside click or Escape, and the top layer (popovertarget
 * + popover). This file mirrors that into `isOpen` and moves focus in and back.
 *
 * Non-modal on purpose: no focus trap and no scroll lock. Tab moves through the
 * panel normally and may leave it — that is the difference from the modal.
 *
 * Placement: CSS anchor positioning in the skin. Where the browser lacks it,
 * _place() sets top/left from the trigger's box and follows scroll and resize.
 *
 * Markup contract:
 *   <micra-popover>
 *     <button class="micra-popover__trigger" data-ref="trigger"
 *             popovertarget="popover-panel" aria-haspopup="dialog"
 *             data-bind="aria-expanded:isOpen ? 'true' : 'false'">…</button>
 *
 *     <div class="micra-popover__panel" id="popover-panel" role="dialog" popover
 *          aria-labelledby="popover-title" data-ref="panel" tabindex="-1"
 *          @toggle="onToggle"> … </div>
 *   </micra-popover>
 */
Micra.define('popover', {
  state: { isOpen: false },

  onCreate() {
    // A unique anchor name per instance, so several popovers on a page each
    // attach their panel to their own trigger.
    const name = '--micra-popover-' + Math.random().toString(36).slice(2);
    this.refs.trigger.style.anchorName = name;
    this.refs.panel.style.positionAnchor = name;
  },

  toggle() {
    this.refs.panel.togglePopover();
  },

  open() {
    if (!this.state.isOpen) this.refs.panel.showPopover();
  },

  close() {
    if (this.state.isOpen) this.refs.panel.hidePopover();
  },

  // The popover opened or closed: by the trigger, an outside click, Escape,
  // or open()/close().
  onToggle(e) {
    const panel = this.refs.panel;
    if (e.newState === 'open') {
      this.state.isOpen = true;
      this._place();
      (this._focusables(panel)[0] || panel).focus();
    } else {
      this.state.isOpen = false;
      if (this._unfollow) this._unfollow();
      // Return focus to the trigger, unless the user clicked somewhere else.
      const a = document.activeElement;
      if (!a || a === document.body || panel.contains(a)) this.refs.trigger.focus();
    }
  },

  // — internals ————————————————————————————————————————————————
  // Without CSS anchor positioning, put the panel under the trigger by hand and
  // keep it there while the page scrolls or resizes.
  _place() {
    if (CSS.supports('position-anchor: --a')) return;
    const follow = () => {
      const r = this.refs.trigger.getBoundingClientRect();
      this.refs.panel.style.top = r.bottom + 'px'; // the skin's margin adds the gap
      this.refs.panel.style.left = r.left + 'px';
    };
    follow();
    const offScroll = this.listen(window, 'scroll', follow, true);
    const offResize = this.listen(window, 'resize', follow);
    this._unfollow = () => (offScroll(), offResize(), (this._unfollow = null));
  },

  _focusables(root) {
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  },
});
