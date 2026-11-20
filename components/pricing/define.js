/*
 * components/pricing/define.js — Pricing / Quote builder (headless behavior).
 *
 * A catalog-driven quote builder: pick a plan, set a seat count, toggle add-ons
 * (some flat, some per-quantity), switch monthly/yearly billing, and watch a live
 * quote total. Pair with pricing.css (default skin) and theme/theme.css (tokens).
 * The markup renders the plan cards and add-on rows from config methods via
 * data-each, and lists the live quote from lineItems(); this file owns everything
 * else: the catalog, the selection state, and the pricing math.
 *
 * State is a SHALLOW proxy — nested writes go through this.set('path.x', v), which
 * replaces the top-level container under the hood rather than mutating a nested
 * object in place. The catalog (plans / addons / yearlyDiscount) and the currency
 * code are seeded ONCE from a data-config JSON attr in onCreate and REPLACED into
 * state. Every money figure — each line item, the subtotal, the yearly discount,
 * the grand total — is a METHOD, never a state field. State holds only the raw
 * selection: which plan, how many seats, which add-ons (and their quantities), and
 * the billing period.
 *
 * CONFIG shape (seeded from a data-config JSON attr, then REPLACED into state):
 *   { plans:  [ { id, name, base, perSeat, blurb? } ],
 *     addons: [ { id, name, price, type: 'toggle' | 'qty', unit? } ],
 *     yearlyDiscount: 0.2,          // fraction off the yearly price (0..1)
 *     currency: 'USD', locale: 'en-US' }
 *
 * SELECTION shape (state.addons):
 *   { <addonId>: true }             // a selected toggle add-on
 *   { <addonId>: <qty:number> }     // a qty add-on with its count (0 = off)
 * A qty add-on stores a number; a toggle stores a boolean. addonAmount() reads the
 * type from the config to know which.
 *
 * ARIA values are bound as STRINGS, not bare booleans: plan cards carry
 * aria-checked 'true'/'false' (role=radio), add-on toggles aria-checked
 * 'true'/'false' (role=checkbox), and the billing buttons aria-pressed
 * 'true'/'false' (role=switch is on the group). A boolean bind would set/drop the
 * attribute, which is wrong for an ARIA state value.
 *
 * Markup-side notes: methods are called with parens in data-text (total()); a
 * method must not share a name with a state key, or the state key wins in an
 * expression — hence the selection key `addons` is state while the per-row helpers
 * are addonList()/addonQty()/addonOn(). data-bind splits pairs on commas, so any
 * helper that needs more than one argument takes a single packed string
 * (planSelected uses the bare id; addon helpers take the add-on id directly).
 */
Micra.define('pricing', {
  state: {
    planId: '',            // selected plan id
    seats: 1,              // seat count (>= 1)
    addons: {},            // { <addonId>: true | <qty:number> }
    billing: 'monthly',    // 'monthly' | 'yearly'

    email: '',             // optional "email me the quote" field
    emailError: '',        // validation message for the email field, or ''

    // Catalog — seeded from data-config in onCreate (REPLACED), defaults below so
    // the component is inert-but-valid if no config is supplied.
    plans: [],             // [ { id, name, base, perSeat, blurb? } ]
    addonsConfig: [],      // [ { id, name, price, type, unit? } ]
    yearlyDiscount: 0,     // fraction off yearly (0..1)
    currency: 'USD',
    locale: 'en-US',
  },

  onCreate() {
    // Seed the catalog from a data-config JSON attr. An object default makes prop()
    // parse it (a malformed attr falls back to {}, so the mount never crashes);
    // REPLACE the relevant top-level keys.
    const cfg = this.prop('config', {});
    if (cfg && typeof cfg === 'object') {
      if (Array.isArray(cfg.plans)) this.state.plans = cfg.plans;
      if (Array.isArray(cfg.addons)) this.state.addonsConfig = cfg.addons;
      if (cfg.yearlyDiscount != null) this.state.yearlyDiscount = Number(cfg.yearlyDiscount) || 0;
      if (cfg.currency) this.state.currency = cfg.currency;
      if (cfg.locale) this.state.locale = cfg.locale;
    }

    // Sensible defaults for the raw selection. prop() casts a present numeric to a
    // number; default the plan to the first in the catalog, seats to a clamped
    // prop (min 1), billing to a known value.
    const firstPlan = this.state.plans[0];
    this.state.planId = this.prop('plan', firstPlan ? firstPlan.id : '') || (firstPlan ? firstPlan.id : '');
    this.state.seats = Math.max(1, this.prop('seats', 1) || 1);
    const billing = this.prop('billing', 'monthly');
    if (billing === 'yearly' || billing === 'monthly') this.state.billing = billing;

    // Build the initial add-on selection: qty add-ons start at 0, toggles start
    // off (absent). Assign once (shallow proxy — replace the top-level key).
    const sel = {};
    this.state.addonsConfig.forEach((a) => {
      if (a.type === 'qty') sel[a.id] = 0;
    });
    this.state.addons = sel;

    // Cache an Intl formatter for the configured currency/locale. Rebuilt only if
    // the currency ever changes (it doesn't, post-seed), so build it lazily.
    this._fmt = null;
  },

  onDestroy() {
    // No timers or document listeners to clean up — selection is all in state and
    // re-render is automatic. (Kept for symmetry with the other components.)
  },

  // — plan selection ————————————————————————————————————————————————
  // Cards are role=radio; selecting one writes the raw id. Keyboard (Enter/Space)
  // and click both land here via @click / @keydown.enter / @keydown.space.
  selectPlan(id) {
    if (this.state.planId === id) return;
    this.state.planId = id;
  },

  // — seats stepper —————————————————————————————————————————————————
  // Min 1; no max (the host can cap if needed). incSeats/decSeats drive the − / +
  // buttons; setSeats handles a typed number input (data-model would fight a
  // focused field on re-render, so we read @input and clamp).
  incSeats() { this.state.seats = this.state.seats + 1; },
  decSeats() { this.state.seats = Math.max(1, this.state.seats - 1); },
  setSeats(e) {
    const n = parseInt(e.target.value, 10);
    // Empty / non-numeric while typing: leave state at its last valid value but do
    // not fight the field. A blur re-render will reflect the clamped value.
    if (Number.isNaN(n)) return;
    this.state.seats = Math.max(1, n);
  },
  // On blur, normalise the field to the clamped state value (so "0" or "" becomes
  // 1 in the input, matching state). Focus-only / value-only touch is fine here
  // because the field is no longer focused.
  normalizeSeats(e) {
    e.target.value = String(this.state.seats);
  },

  // — add-on toggles & quantities ———————————————————————————————————
  // Toggle add-on: flip presence in the selection. Replace the addons object
  // (shallow proxy) each time rather than mutating in place.
  toggleAddon(id) {
    const addons = Object.assign({}, this.state.addons);
    if (addons[id]) delete addons[id];
    else addons[id] = true;
    this.state.addons = addons;
  },

  // Qty add-on steppers. Min 0 (0 = not on the quote). Replace the object.
  incAddon(id) {
    const addons = Object.assign({}, this.state.addons);
    addons[id] = (Number(addons[id]) || 0) + 1;
    this.state.addons = addons;
  },
  decAddon(id) {
    const addons = Object.assign({}, this.state.addons);
    addons[id] = Math.max(0, (Number(addons[id]) || 0) - 1);
    this.state.addons = addons;
  },

  // — billing toggle ————————————————————————————————————————————————
  setBilling(period) {
    if (period !== 'monthly' && period !== 'yearly') return;
    if (this.state.billing === period) return;
    this.state.billing = period;
  },
  isYearly() { return this.state.billing === 'yearly'; },

  // — derived: catalog readouts (methods, never state) ——————————————
  // The plan/add-on lists for the template's data-each loops. Distinct names from
  // the state keys (plans/addonsConfig) keeps the expression engine unambiguous,
  // and addonList() is the public name for the add-on catalog.
  planList()  { return this.state.plans; },
  addonList() { return this.state.addonsConfig; },

  plan() {
    return this.state.plans.find((p) => p.id === this.state.planId) || null;
  },
  planName() {
    const p = this.plan();
    return p ? p.name : '';
  },
  planSelected(id) { return this.state.planId === id; },

  // — derived: add-on row state ——————————————————————————————————————
  isToggleAddon(a) { return a.type !== 'qty'; },
  isQtyAddon(a)    { return a.type === 'qty'; },
  // A toggle add-on is "on" when its selection value is truthy. For a qty add-on,
  // "on" means qty > 0. Both read the raw selection.
  addonOn(id) {
    const v = this.state.addons[id];
    return typeof v === 'number' ? v > 0 : !!v;
  },
  addonQty(id) {
    const v = this.state.addons[id];
    return typeof v === 'number' ? v : 0;
  },
  // Per-row price label, e.g. "$5.00" or "$2.00 / GB". Reads the add-on's config.
  addonPriceLabel(a) {
    const price = this.money(a.price);
    return a.unit ? price + ' / ' + a.unit : price;
  },
  // Per-row line amount for the selected quantity / toggle (0 when off).
  addonRowAmount(id) {
    return this.money(this._addonAmount(id));
  },

  // — derived: the pricing math ——————————————————————————————————————
  // lineItems() is the single source of truth for the quote: it returns the raw
  // monthly line items (plan base, seats × perSeat, each selected add-on) as
  // [{ id, label, amount }]. subtotal() sums them. The yearly path multiplies the
  // monthly subtotal by 12 and applies the discount; monthly is the subtotal as-is.
  // Every figure here is computed on read — nothing is stored.
  lineItems() {
    const items = [];
    const plan = this.plan();
    if (!plan) return items;

    // Plan base (flat, per period before the monthly/yearly expansion).
    if (plan.base) {
      items.push({ id: 'plan-base', label: plan.name + ' base', amount: plan.base });
    }
    // Seats × per-seat price.
    if (plan.perSeat) {
      const seats = this.state.seats;
      items.push({
        id: 'plan-seats',
        label: seats + ' seat' + (seats === 1 ? '' : 's') + ' × ' + this.money(plan.perSeat),
        amount: plan.perSeat * seats,
      });
    }
    // Each selected add-on (toggle present, or qty > 0).
    this.state.addonsConfig.forEach((a) => {
      const amount = this._addonAmount(a.id);
      if (amount <= 0) return;
      const qty = this.addonQty(a.id);
      const label =
        a.type === 'qty'
          ? a.name + ' × ' + qty + (a.unit ? ' ' + a.unit : '')
          : a.name;
      items.push({ id: 'addon-' + a.id, label, amount });
    });

    return items;
  },

  // Monthly subtotal — the sum of the (monthly) line items, before any yearly
  // expansion or discount.
  subtotal() {
    return this.lineItems().reduce((sum, it) => sum + it.amount, 0);
  },

  // The amount the yearly discount removes, in the BILLED currency for the period
  // shown. Zero on monthly. On yearly: (monthly subtotal × 12) × discount.
  discount() {
    if (!this.isYearly()) return 0;
    return this.subtotal() * 12 * this.state.yearlyDiscount;
  },

  // The headline total for the selected period. Monthly = the monthly subtotal.
  // Yearly = twelve months of subtotal minus the yearly discount.
  total() {
    if (!this.isYearly()) return this.subtotal();
    return this.subtotal() * 12 - this.discount();
  },

  // — derived: formatted money (for data-text) ——————————————————————
  // Currency-formatted strings off the same figures, via the cached Intl
  // formatter. These are what the template binds.
  subtotalText() { return this.money(this.subtotal()); },
  discountText() { return this.money(this.discount()); },
  totalText()    { return this.money(this.total()); },

  // The unit shown next to the total: "/ mo" or "/ yr".
  periodLabel() { return this.isYearly() ? '/ yr' : '/ mo'; },

  // The discount as a readable percentage, e.g. "20% off" — for the yearly badge.
  discountBadge() {
    const pct = Math.round(this.state.yearlyDiscount * 100);
    return pct + '% off';
  },
  hasDiscount() { return this.isYearly() && this.state.yearlyDiscount > 0 && this.subtotal() > 0; },

  // The intl currency helper. A single, reused Intl.NumberFormat — building one
  // per call is measurably slow. Falls back to a plain fixed-2 string if Intl or
  // the currency code is unavailable.
  money(n) {
    const amount = Number(n) || 0;
    if (!this._fmt) {
      try {
        this._fmt = new Intl.NumberFormat(this.state.locale || 'en-US', {
          style: 'currency',
          currency: this.state.currency || 'USD',
        });
      } catch (e) {
        this._fmt = null;
      }
    }
    if (this._fmt) return this._fmt.format(amount);
    return (this.state.currency || 'USD') + ' ' + amount.toFixed(2);
  },

  // — actions ————————————————————————————————————————————————————————
  // Emit the full quote. The host owns turning this into a real PDF or an email —
  // we hand back a plain, serialisable snapshot of the selection plus the computed
  // figures and line items. (See README: server-side PDF/email is the host's job.)
  requestQuote() {
    this.emit('quote', this._quote());
  },

  // Print / Save as PDF. The skin carries a print-only stylesheet that hides the
  // controls and prints just the quote summary, so window.print() (and the
  // browser's "Save as PDF") produces a clean one-page quote. No server needed for
  // the print path; a real generated-PDF/email flow is the host's job (README).
  printQuote() {
    window.print();
  },

  // — email capture (optional) ——————————————————————————————————————
  // A typed email field. data-model would fight a focused input on re-render, so
  // we read @input and validate on demand. Distinct from the quote emit: emailing
  // the quote bundles the address into the payload.
  onEmail(e) {
    this.state.email = e.target.value;
    if (this.state.emailError) this._validateEmail(); // clear a shown error as they fix it
  },
  emailQuote() {
    if (!this._validateEmail()) return;
    this.emit('quote', Object.assign({ email: this.state.email }, this._quote()));
  },
  emailErrorText() { return this.state.emailError || ''; },
  hasEmailError() { return !!this.state.emailError; },

  // — internals ————————————————————————————————————————————————————
  // The selected amount for one add-on: 0 when off, price for a toggle, price ×
  // qty for a qty add-on. Reads both the config (type/price) and the selection.
  _addonAmount(id) {
    const a = this.state.addonsConfig.find((x) => x.id === id);
    if (!a) return 0;
    if (a.type === 'qty') {
      const qty = this.addonQty(id);
      return qty > 0 ? a.price * qty : 0;
    }
    return this.addonOn(id) ? a.price : 0;
  },

  // A plain, serialisable snapshot of the quote for the 'quote' event. lineItems()
  // is already plain objects; copy the addons selection out of the proxy.
  _quote() {
    const addons = {};
    for (const k in this.state.addons) addons[k] = this.state.addons[k];
    return {
      planId: this.state.planId,
      seats: this.state.seats,
      addons,
      billing: this.state.billing,
      lineItems: this.lineItems(),
      subtotal: this.subtotal(),
      discount: this.discount(),
      total: this.total(),
      currency: this.state.currency,
    };
  },

  _validateEmail() {
    const v = (this.state.email || '').trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    this.state.emailError = ok ? '' : 'Enter a valid email address';
    return ok;
  },
});
