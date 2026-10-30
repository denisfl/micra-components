/*
 * components/breadcrumbs/define.js — Breadcrumbs (headless behavior).
 *
 * Pair with breadcrumbs.css (default skin) and theme/theme.css (tokens). The
 * markup renders the trail from state via data-each; this file owns the data
 * logic: which crumb is current (the last one) and the navigate intent.
 *
 * Breadcrumbs are data-driven: state.items holds { id, label[, href] } and the
 * LAST item is the current page. "Is this the current crumb?" is a method,
 * never state — state stays raw data only.
 *
 * Markup contract:
 *   <nav data-component="breadcrumbs" aria-label="Breadcrumb">
 *     <ol class="micra-breadcrumbs">
 *       <template data-each="items" data-key="id">
 *         <li class="micra-breadcrumbs__crumb">
 *           <a data-show="!isLast(index)" …>…</a>            ← link for ancestors
 *           <span data-show="isLast(index)" aria-current="page" …>…</span>  ← current
 *         </li>
 *       </template>
 *     </ol>
 *   </nav>
 */
Micra.define('breadcrumbs', {
  state: {
    items: [
      { id: 'home', label: 'Home', href: '#' },
      { id: 'products', label: 'Products', href: '#' },
      { id: 'footwear', label: 'Footwear', href: '#' },
      { id: 'trail-runner', label: 'Trail Runner', href: '#' },
    ],
  },

  // — derived (methods, never state) ——————————————————————————————
  // The current page is the last crumb: rendered as plain text with
  // aria-current="page", not as a link.
  isLast(index) {
    return index === this.state.items.length - 1;
  },

  // — navigation ————————————————————————————————————————————————
  // Emits the chosen crumb so a host can route in-app. Real hrefs still work on
  // their own; the demo calls preventDefault and listens for this instead.
  navigate(id) {
    const item = this.state.items.find((i) => i.id === id);
    if (item) this.emit('navigate', item);
  },
});
