/*
 * components/slideover/define.js — Slide-over / drawer (headless behavior) on a
 * native <dialog>.
 *
 * A modal side drawer: same mechanics as the modal. showModal() makes the page
 * behind inert (Tab stays inside), Escape closes, focus moves in and comes back,
 * and the drawer sits in the top layer. The panel slides in from an edge instead
 * of centering. Pair with slideover.css (default skin) and theme/theme.css (tokens).
 *
 * Two data-* props on the root drive position:
 *   data-side="right|left|top|bottom"  (default "right")
 *   data-size="24rem"                  (optional; the skin has a sensible default)
 * Both are mirrored onto the dialog/panel as a data-side attribute the skin uses
 * to pick the edge and the slide transform, and as a --micra-slideover-size
 * custom property when a size is given.
 *
 * Markup contract:
 *   <micra-slideover data-side="right" data-size="24rem">
 *     <button @click="open">…</button>
 *     <dialog class="micra-slideover" data-ref="dialog" aria-labelledby="…"
 *             data-bind="data-side:side()" @close="closed" @click.self="close">
 *       <div class="micra-slideover__panel"
 *            data-bind="data-side:side(), style:panelStyle()"> … </div>
 *     </dialog>
 *   </micra-slideover>
 */
Micra.define('slideover', {
  state: { open: false },

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
  // From a click, remember the trigger: Safari doesn't focus a clicked button,
  // so the browser's own focus return has nothing to go back to. Called from
  // code (templates open the editor this way) the browser restores focus.
  open(e) {
    this._trigger = e && e.currentTarget;
    this.refs.dialog.showModal();
    this.state.open = true;
  },

  // Fires the dialog's close event, which runs closed() below.
  close() {
    this.refs.dialog.close();
  },

  // The dialog closed: by close(), Escape, or a <form method="dialog">.
  closed() {
    this.state.open = false;
    if (this._trigger) this._trigger.focus();
  },
});
