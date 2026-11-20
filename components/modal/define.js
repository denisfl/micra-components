/*
 * components/modal/define.js — Modal (headless behavior) on a native <dialog>.
 *
 * Pair with modal.css (default skin) and theme/theme.css (tokens). showModal()
 * gives the browser's own modal behavior: the page behind becomes inert (Tab
 * stays inside), Escape closes, focus moves in and returns to the trigger on
 * close, and the dialog sits in the top layer above everything. This file only
 * opens and closes it, mirrors that into `isOpen`, returns focus to the button
 * that opened it, and closes on a backdrop click.
 *
 * Markup contract:
 *   <micra-modal data-title="…">
 *     <button @click="open">…</button>
 *     <dialog class="micra-modal" data-ref="dialog" aria-labelledby="…"
 *             @close="closed" @click.self="close">
 *       <div class="micra-modal__dialog"> … <button @click="close">…</button> </div>
 *     </dialog>
 *   </micra-modal>
 */
Micra.define('modal', {
  state: { isOpen: false, title: '' },

  onCreate() {
    this.state.title = this.prop('title') || 'Dialog';
  },

  // From a click, remember the trigger: Safari doesn't focus a clicked button,
  // so the browser's own focus return has nothing to go back to.
  open(e) {
    this._trigger = e && e.currentTarget;
    this.refs.dialog.showModal();
    this.state.isOpen = true;
  },

  // Fires the dialog's close event, which runs closed() below.
  close() {
    this.refs.dialog.close();
  },

  // The dialog closed: by close(), Escape, or a <form method="dialog">.
  closed() {
    this.state.isOpen = false;
    if (this._trigger) this._trigger.focus();
  },
});
