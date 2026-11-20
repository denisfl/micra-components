/*
 * components/minicart/define.js — Mini-cart / Checkout (headless behavior).
 *
 * A shopping cart in a modal side drawer with a multi-step checkout. The drawer is
 * a native <dialog> like the slideover: showModal() makes the page inert (Tab
 * stays inside), Escape closes, focus moves in and returns, backdrop click and
 * scroll lock come from the skin. On top of that
 * it owns the cart math (line totals, subtotal, coupon discount, shipping, total),
 * a coupon validator, and a cart -> details -> review wizard with per-field
 * validation that blocks advancing while a step is invalid. Pair with
 * minicart.css (default skin) and theme/theme.css (tokens).
 *
 * State is a SHALLOW proxy: arrays and objects are REPLACED, never mutated in
 * place. Line items live in state.items as an array — setQty/inc/dec/remove build
 * a fresh array and assign it. Nested fields (the checkout form) are written with
 * this.set('fields.x', v), which replaces the top-level container under the hood.
 * Every derived value — item count, subtotal, discount, shipping, total, step
 * validity, formatted currency — is a METHOD, never a state field.
 *
 * Two JSON props seed the cart in onCreate (parsed by prop() with an array/object
 * default, Micra 2.14+, then REPLACED):
 *   data-items='[{ "id", "name", "price", "qty" }, …]'   line items (price in cents)
 *   data-coupons='{ "CODE": { "type": "percent"|"shipping", "value"? }, … }'
 * plus optional scalars:
 *   data-currency="$"        prefix for formatted money (default "$")
 *   data-shipping="500"      flat shipping in cents applied when there are items
 *   data-free-over="5000"    subtotal (cents) above which shipping is free
 *
 * Markup contract (see index.html for the full template):
 *   <micra-minicart data-items='…' data-coupons='…'>
 *     <button @click="open">Cart (<span data-text="itemCount()"></span>)</button>
 *     <dialog class="micra-minicart" data-ref="dialog" aria-labelledby="…"
 *             @close="closed" @click.self="close">
 *       <div class="micra-minicart__panel"> … </div>
 *     </dialog>
 *   </micra-minicart>
 *
 * GOTCHAS this file works around:
 *  - prop() on a bare data-* attr returns "" (falsy), and casts "true"/numbers; a
 *    JSON prop needs an array/object default to be parsed (Micra 2.14+).
 *  - ARIA / state styling values are bound as STRINGS ('true'/'false', step tokens)
 *    in the markup, never bare booleans.
 *  - A method must not share a name with a state key (the key would win in an
 *    expression), so the items state is read in the template via lineItems(), and
 *    the coupon string via couponCode()/onCoupon while state.coupon stays the
 *    data-model target.
 *  - User-typed inputs (coupon, checkout fields) use data-model / @input; JS-set
 *    readouts (the qty number) render via data-text on a row var.
 *  - Inline style objects (none needed here) would have to come from a method.
 */
Micra.define('minicart', {
  state: {
    open: false,
    items: [],          // [{ id, name, price (cents), qty }]
    coupon: '',         // the coupon input's live text (data-model target)
    appliedCoupon: null,// { code, type, value } once a valid code is applied
    couponError: '',    // message shown when applyCoupon() rejects a code
    step: 'cart',       // 'cart' | 'details' | 'review'
    fields: {},         // { name, email, address }
    errors: {},         // { <fieldName>: message } — only invalid fields present
    touched: {},        // { <fieldName>: true } — blurred or advance-attempted
    placed: false,      // true after a successful placeOrder()
  },

  onCreate() {
    // Seed items + coupons from JSON props (array/object default → parsed, then REPLACE).
    const items = this.prop('items', []);
    if (Array.isArray(items) && items.length) {
      this.state.items = items.map((it) => ({
        id: it.id,
        name: it.name,
        price: Number(it.price) || 0,
        qty: Math.max(1, Number(it.qty) || 1),
      }));
    }

    const coupons = this.prop('coupons', {});
    this._coupons = coupons && typeof coupons === 'object' ? coupons : {};

    // Money config. prop() casts a present numeric to a number; default the rest.
    this._currency = this.prop('currency', '$') || '$';
    this._flatShipping = this.prop('shipping', 0) || 0;
    // -1 sentinel = "no free-shipping threshold". prop() returns the default when absent.
    this._freeOver = this.prop('freeOver', -1);

    this.state.fields = { name: '', email: '', address: '' };
  },

  // — drawer actions ————————————————————————————————————————————————
  // From a click, remember the trigger: Safari doesn't focus a clicked button,
  // so the browser's own focus return has nothing to go back to.
  open(e) {
    this._trigger = e && e.currentTarget;
    this.refs.dialog.showModal();
    this.state.open = true;
  },

  // Fires the dialog's close event, which runs closed() below.
  close() {
    this.refs.dialog.close();
  },

  // The dialog closed: by close(), Escape, or a backdrop click.
  closed() {
    this.state.open = false;
    if (this._trigger) this._trigger.focus();
  },

  // — line items ————————————————————————————————————————————————————
  // Set an explicit quantity (min 1). Replace the items array (shallow proxy).
  setQty(id, qty) {
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    this.state.items = this.state.items.map((it) =>
      it.id === id ? Object.assign({}, it, { qty: n }) : it
    );
  },

  inc(id) {
    const it = this._item(id);
    if (it) this.setQty(id, it.qty + 1);
  },

  dec(id) {
    const it = this._item(id);
    if (it) this.setQty(id, it.qty - 1); // setQty floors at 1
  },

  // The qty <input> writes through here (@input). Empty / NaN snaps back to 1 on
  // the next render because setQty clamps and the input mirrors fieldValue.
  onQty(id, e) {
    this.setQty(id, e.target.value);
  },

  remove(id) {
    this.state.items = this.state.items.filter((it) => it.id !== id);
    // Dropping the last item while deeper in checkout would strand the user on an
    // empty step — send them back to the cart.
    if (this.state.items.length === 0) this.state.step = 'cart';
  },

  // — coupon ————————————————————————————————————————————————————————
  // Validate state.coupon against the seeded map. On success set appliedCoupon and
  // clear the error; on failure clear appliedCoupon and set a message.
  applyCoupon() {
    const code = String(this.state.coupon || '').trim().toUpperCase();
    if (!code) {
      this.state.couponError = 'Enter a coupon code';
      this.state.appliedCoupon = null;
      return;
    }
    const found = this._coupons[code];
    if (!found) {
      this.state.couponError = 'That code is not valid';
      this.state.appliedCoupon = null;
      return;
    }
    this.state.couponError = '';
    this.state.appliedCoupon = Object.assign({ code: code }, found);
  },

  removeCoupon() {
    this.state.appliedCoupon = null;
    this.state.couponError = '';
    this.state.coupon = '';
  },

  // — multi-step ————————————————————————————————————————————————————
  // cart -> details -> review. Advancing out of a step is gated on stepValid().
  toCart()    { this.state.step = 'cart'; },
  toDetails() {
    if (this.itemCount() === 0) return;       // can't check out an empty cart
    this.state.step = 'details';
  },
  toReview() {
    // Validate the details form; block + surface errors when invalid.
    if (!this._validateFields(['name', 'email', 'address'])) {
      this._touch(['name', 'email', 'address']);
      this.tick().then(() => this._focusFirstInvalid());
      return;
    }
    this.state.step = 'review';
  },

  // Place the order: re-validate the form (defensive), emit 'checkout' with a
  // plain snapshot, and flip to the success state.
  placeOrder() {
    if (!this._validateFields(['name', 'email', 'address'])) {
      this._touch(['name', 'email', 'address']);
      this.state.step = 'details';
      return;
    }
    this.emit('checkout', {
      items: this._plainItems(),
      appliedCoupon: this.state.appliedCoupon,
      totals: {
        subtotal: this.subtotalValue(),
        discount: this.discountValue(),
        shipping: this.shippingValue(),
        total: this.totalValue(),
      },
      fields: Object.assign({}, this.state.fields),
    });
    this.state.placed = true;
  },

  // Reset back to a fresh cart view (used by the success state's "Done"/close).
  reset() {
    this.state.placed = false;
    this.state.step = 'cart';
  },

  // — checkout form input ——————————————————————————————————————————
  // Names are dynamic per field, so build the path and use this.set() (the
  // dot-path setter that keeps the shallow proxy intact).
  onField(name, e) {
    this.set('fields.' + name, e.target.value);
    if (this.isTouched(name)) this.validateField(name); // clear a fixed error live
  },

  onFieldBlur(name) {
    this.set('touched.' + name, true);
    this.validateField(name);
  },

  // — derived: line + cart math (money is integer cents) ————————————
  // Read items in the template through this (a method, so it never collides with
  // the items state key in an expression).
  lineItems() { return this.state.items; },

  isEmpty()   { return this.state.items.length === 0; },

  itemCount() {
    return this.state.items.reduce((n, it) => n + it.qty, 0);
  },

  // Per-row total — takes the row item, returns formatted money for data-text.
  lineTotal(item) { return this.money(item.price * item.qty); },
  // Per-row unit price, formatted.
  unitPrice(item) { return this.money(item.price); },

  subtotalValue() {
    return this.state.items.reduce((sum, it) => sum + it.price * it.qty, 0);
  },
  subtotal() { return this.money(this.subtotalValue()); },

  // Discount in cents from the applied coupon. A percent coupon takes a slice of
  // the subtotal; a shipping coupon discounts nothing here (it zeroes shipping).
  discountValue() {
    const c = this.state.appliedCoupon;
    if (!c) return 0;
    if (c.type === 'percent') {
      return Math.round((this.subtotalValue() * (Number(c.value) || 0)) / 100);
    }
    return 0;
  },
  discount() { return this.money(this.discountValue()); },
  hasDiscount() { return this.discountValue() > 0; },

  // Shipping in cents: flat fee when there are items, waived by a 'shipping'
  // coupon or once the (post-discount) subtotal clears the free-over threshold.
  shippingValue() {
    if (this.isEmpty()) return 0;
    const c = this.state.appliedCoupon;
    if (c && c.type === 'shipping') return 0;
    const net = this.subtotalValue() - this.discountValue();
    if (this._freeOver >= 0 && net >= this._freeOver) return 0;
    return this._flatShipping;
  },
  shipping() { return this.money(this.shippingValue()); },
  isFreeShipping() { return !this.isEmpty() && this.shippingValue() === 0; },

  totalValue() {
    return Math.max(
      0,
      this.subtotalValue() - this.discountValue() + this.shippingValue()
    );
  },
  total() { return this.money(this.totalValue()); },

  // — derived: coupon view ——————————————————————————————————————————
  hasCoupon()    { return this.state.appliedCoupon != null; },
  couponLabel()  {
    const c = this.state.appliedCoupon;
    if (!c) return '';
    if (c.type === 'percent') return c.code + ' (-' + (Number(c.value) || 0) + '%)';
    if (c.type === 'shipping') return c.code + ' (free shipping)';
    return c.code;
  },
  hasCouponError() { return !!this.state.couponError; },

  // — derived: steps ————————————————————————————————————————————————
  isStep(name)  { return this.state.step === name; },
  // data-state / aria-current token for a stepper item.
  stepState(name) {
    const order = ['cart', 'details', 'review'];
    const here = order.indexOf(this.state.step);
    const at = order.indexOf(name);
    if (at === here) return 'current';
    if (at < here) return 'done';
    return 'upcoming';
  },
  isCurrentStep(name) { return this.state.step === name; },

  // Whether a given step is satisfied — drives the disabled state of Continue and
  // is reused by stepState for the "done" check on revisits.
  stepValid(step) {
    if (step === 'cart') return this.itemCount() > 0;
    if (step === 'details') {
      return ['name', 'email', 'address'].every(
        (n) => !this._ruleError(n, this.state.fields[n])
      );
    }
    return true; // review has no inputs of its own
  },

  // — derived: validation view ——————————————————————————————————————
  validateField(name) {
    const msg = this._ruleError(name, this.state.fields[name]);
    const errors = Object.assign({}, this.state.errors);
    if (msg) errors[name] = msg;
    else delete errors[name];
    this.state.errors = errors;
    return !msg;
  },

  hasError(name) { return this.isTouched(name) && !!this.state.errors[name]; },
  errorFor(name) { return this.hasError(name) ? this.state.errors[name] : ''; },
  isTouched(name) { return !!this.state.touched[name]; },
  fieldValue(name) {
    const v = this.state.fields[name];
    return v == null ? '' : v;
  },
  // Stable per-field id so multiple carts on a page don't collide.
  fieldId(name) { return 'mc-' + this._uid() + '-' + name; },
  errorId(name) { return this.fieldId(name) + '-err'; },

  // — money formatting ——————————————————————————————————————————————
  // Cents → "$12.34". Single formatter so every readout is consistent; the prefix
  // comes from data-currency.
  money(cents) {
    const n = (Number(cents) || 0) / 100;
    return this._currency + n.toFixed(2);
  },

  // — internals ————————————————————————————————————————————————————
  _validateFields(names) {
    const errors = Object.assign({}, this.state.errors);
    let ok = true;
    names.forEach((name) => {
      const msg = this._ruleError(name, this.state.fields[name]);
      if (msg) { errors[name] = msg; ok = false; }
      else delete errors[name];
    });
    this.state.errors = errors;
    return ok;
  },

  // The checkout form's rules. Returns an error message, or '' when valid.
  _ruleError(name, value) {
    const str = value == null ? '' : String(value).trim();
    if (name === 'name') {
      if (!str) return 'Name is required';
      return '';
    }
    if (name === 'email') {
      if (!str) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return 'Enter a valid email address';
      return '';
    }
    if (name === 'address') {
      if (!str) return 'Address is required';
      return '';
    }
    return '';
  },

  _touch(names) {
    const touched = Object.assign({}, this.state.touched);
    names.forEach((n) => { touched[n] = true; });
    this.state.touched = touched;
  },

  _focusFirstInvalid() {
    const bad = ['name', 'email', 'address'].find(
      (n) => this._ruleError(n, this.state.fields[n])
    );
    if (!bad) return;
    const el = this.$el.querySelector('#' + this.fieldId(bad));
    if (el && el.focus) el.focus();
  },

  _item(id) {
    return this.state.items.find((it) => it.id === id) || null;
  },

  // Plain (non-proxy) snapshot of the items for emit.
  _plainItems() {
    return this.state.items.map((it) => ({
      id: it.id, name: it.name, price: it.price, qty: it.qty,
    }));
  },

  _uid() {
    if (!this._uidValue) this._uidValue = Math.random().toString(36).slice(2, 8);
    return this._uidValue;
  },
});
