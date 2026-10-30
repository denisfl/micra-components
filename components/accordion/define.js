/*
 * components/accordion/define.js — Accordion / Disclosure group (headless behavior).
 *
 * Pair with accordion.css (default skin) and theme/theme.css (tokens). The markup
 * sets data-state per item via data-bind, so styling reacts to open/closed; this
 * file owns the behavior: toggle (single or multiple), open-state tracking, and
 * roving focus across the headers.
 *
 * Markup contract:
 *   <div data-component="accordion" data-multiple="false">
 *     <template data-each="items" data-key="id">
 *       <div class="micra-accordion__item"
 *            data-bind="data-state:isOpen(item.id) ? 'open' : 'closed'">
 *         <button class="micra-accordion__header" data-ref="header"
 *                 data-bind="id:item.id + '-h', aria-controls:item.id + '-p',
 *                            aria-expanded:isOpen(item.id) ? 'true' : 'false'"
 *                 @click="toggle(item.id)"
 *                 @keydown.down.prevent="focusAt(index + 1)"
 *                 @keydown.up.prevent="focusAt(index - 1)"
 *                 @keydown.home.prevent="focusAt(0)"
 *                 @keydown.end.prevent="focusAt(-1)"> … </button>
 *         <div class="micra-accordion__panel" role="region"
 *              data-bind="id:item.id + '-p', aria-labelledby:item.id + '-h'"
 *              data-show="isOpen(item.id)"> … </div>
 *       </div>
 *     </template>
 *   </div>
 */
Micra.define('accordion', {
  state: {
    // Raw data only — derived flags (isOpen) are methods, never state fields.
    items: [
      { id: 'shipping', title: 'How long does shipping take?',
        body: 'Orders ship within one business day and arrive in 3–5 days.' },
      { id: 'returns', title: 'What is your return policy?',
        body: 'Return anything unused within 30 days for a full refund.' },
      { id: 'support', title: 'How do I reach support?',
        body: 'Email support@example.com — we reply within one business day.' },
      { id: 'billing', title: 'Can I change my plan later?',
        body: 'Yes. Upgrade or downgrade anytime; changes are prorated.' },
    ],
    // Ids of the currently-open items. Start with the first item open.
    open: ['shipping'],
  },

  // Derived value — a method, not state. Drives aria-expanded and data-state.
  isOpen(id) {
    return this.state.open.includes(id);
  },

  toggle(id) {
    const open = this.state.open;
    // A bare data-multiple (no value) reads back as '' from prop(); treat
    // anything that is not an explicit false (or absent) as enabling multiple.
    if (this.prop('multiple', false) !== false) {
      // Multiple mode: flip this id, leaving the others untouched.
      this.state.open = open.includes(id)
        ? open.filter((x) => x !== id)
        : [...open, id];
      return;
    }
    // Single mode (default): one item open at a time; re-toggling closes it.
    this.state.open = open.includes(id) ? [] : [id];
  },

  // Roving focus across the header buttons. index is the row index inside
  // data-each; -1 means "last". DOM is queried for focus movement only —
  // open-state always comes from this.state, never from the DOM.
  focusAt(index) {
    const headers = Array.from(
      this.$el.querySelectorAll('.micra-accordion__header')
    );
    if (!headers.length) return;
    const last = headers.length - 1;
    const target = index < 0 ? last : index > last ? 0 : index;
    headers[target].focus();
  },
});
