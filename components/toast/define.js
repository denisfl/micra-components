/*
 * components/toast/define.js — Toast / notifications (headless behavior).
 *
 * Pair with toast.css (default skin) and theme/theme.css (tokens). This is a
 * notifications MANAGER, mounted ONCE: it listens on the global bus and renders a
 * stack of toasts. Any code can fire one with Micra.emit('toast', {message, type,
 * duration}); this file owns the behavior: queueing, per-toast auto-dismiss
 * timers, manual dismiss, and timer cleanup.
 *
 * The region is a manual popover, shown once on mount, so toasts sit in the top
 * layer: above everything, including a modal <dialog>. A toast raised while a
 * modal is open re-shows the region, which puts it back above the modal. (The
 * modal still makes the page inert, so its Dismiss button can't be clicked
 * until the modal closes; the toast times out as usual.)
 *
 * Markup contract (a single element; the region/list lives inside it):
 *   <micra-toast>
 *     <div class="micra-toasts" popover="manual" data-ref="region" role="region"
 *          aria-label="Notifications" aria-live="polite">
 *       <template data-each="toasts" data-key="id">
 *         <div class="micra-toast" role="status"
 *              data-bind="class:toastClass(item)">
 *           <span data-text="item.message"></span>
 *           <button @click="dismiss(item.id)" aria-label="Dismiss">&times;</button>
 *         </div>
 *       </template>
 *     </div>
 *   </micra-toast>
 *
 * Toasts are stored as plain objects {id, message, type}; the array is always
 * REPLACED (shallow proxy — never mutated in place). Ids come from an incrementing
 * counter on the instance, so keys stay stable and unique.
 */
Micra.define('toast', {
  state: { toasts: [] },

  onCreate() {
    this._seq = 0; // monotonic id source — stable data-keys, no Date.now/random
    this._timers = {}; // id -> setTimeout handle, cleared on dismiss and onDestroy

    // Subscribe to the global bus so any code can raise a toast. The bus is
    // auto-cleaned by Micra, but the timers it schedules are ours to clear.
    this.on('toast', (p) => this.add(p || {}));
    this.refs.region.showPopover();
  },

  onDestroy() {
    // Mandatory: clear EVERY outstanding auto-dismiss timer.
    for (const id in this._timers) clearTimeout(this._timers[id]);
    this._timers = {};
  },

  add({ message, type, duration }) {
    const id = ++this._seq;
    const toast = {
      id,
      message: message || '',
      type: type === 'success' || type === 'error' ? type : 'info',
    };
    this.state.toasts = [...this.state.toasts, toast]; // replace, don't mutate

    // A modal opened after the region covers it; showing again moves it on top.
    if (document.querySelector('dialog:modal')) {
      this.refs.region.hidePopover();
      this.refs.region.showPopover();
    }

    // Auto-dismiss after `duration` (default 4s). Store the handle so a manual
    // dismiss or onDestroy can cancel it.
    this._timers[id] = setTimeout(() => this.dismiss(id), duration ?? 4000);
  },

  dismiss(id) {
    if (this._timers[id]) {
      clearTimeout(this._timers[id]);
      delete this._timers[id];
    }
    this.state.toasts = this.state.toasts.filter((t) => t.id !== id); // replace
  },

  // Derived per-toast class — a METHOD (recomputes on read), bound via data-bind.
  // A type modifier on top of the base class drives the skin's accent.
  toastClass(item) {
    return 'micra-toast micra-toast--' + item.type;
  },
});
