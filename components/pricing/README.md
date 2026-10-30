# Pricing

A catalog-driven quote builder: pick a plan, set a seat count, toggle add-ons
(some flat, some per-quantity), switch monthly/yearly billing, and watch a live
quote total. It computes every line item, the subtotal, the yearly discount, and
the grand total, then emits the whole quote for the host to turn into a real PDF
or email. Headless behavior in `define.js`; the look is a default skin in
`pricing.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark): three plans (Starter / Pro /
Business), a seats stepper, a flat add-on and a per-GB add-on, a monthly/yearly
toggle that applies a 20% discount, a live total in a polite live region, and
"Request quote" / "Print / Save PDF" buttons.

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="pricing.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup and seed a catalog. The catalog can come from a
   `data-config` JSON attribute (set it before `Micra.start()`), or you can assign
   the catalog keys on the instance after mount. Optional `data-plan`,
   `data-seats`, and `data-billing` set the initial selection.

   ```html
   <micra-pricing class="micra-pricing">
     <!-- plan cards, seats stepper, add-ons, billing toggle, quote — see
          index.html for the full template -->
   </micra-pricing>

   <script>
     const config = {
       plans: [
         { id: 'starter',  name: 'Starter',  base: 0,   perSeat: 8 },
         { id: 'pro',      name: 'Pro',      base: 49,  perSeat: 12 },
         { id: 'business', name: 'Business', base: 199, perSeat: 16 },
       ],
       addons: [
         { id: 'priority', name: 'Priority support', price: 29, type: 'toggle' },
         { id: 'storage',  name: 'Extra storage',    price: 2,  type: 'qty', unit: 'GB' },
       ],
       yearlyDiscount: 0.2,
       currency: 'USD',
       locale: 'en-US',
     };
     const el = document.querySelector('[data-component="pricing"]');
     el.setAttribute('data-config', JSON.stringify(config));

     Micra.start();

     const pricing = Micra.instances().get(el);
     pricing.on('quote', (quote) => console.log('quote', quote));
   </script>
   ```

3. Call `Micra.start()` once, after the component is defined and the config
   attribute is set.

Multiple builders on one page work out of the box — each
`<micra-pricing>` is an independent instance with its own catalog and
selection.

## Catalog

The catalog is `{ plans, addons, yearlyDiscount, currency, locale }`.

| Key | Type | Notes |
|-----|------|-------|
| `plans` | array | `[{ id, name, base, perSeat, blurb? }]`. `base` is a flat per-period charge; `perSeat` multiplies by the seat count. |
| `addons` | array | `[{ id, name, price, type, unit? }]`. `type` is `'toggle'` (flat, on/off) or `'qty'` (price × quantity); `unit` labels a qty add-on (e.g. `GB`). |
| `yearlyDiscount` | number | Fraction off the yearly price, `0`–`1` (e.g. `0.2` = 20% off). Applied only on yearly billing. |
| `currency` | string | ISO 4217 code for the `Intl.NumberFormat` (default `USD`). |
| `locale` | string | BCP 47 locale for formatting (default `en-US`). |

Initial selection comes from optional props: `data-plan` (a plan id; defaults to
the first plan), `data-seats` (a number, min 1), `data-billing`
(`monthly` | `yearly`).

## State and events

State holds the raw selection and the seeded catalog only; every money figure is
a method.

- `state.planId` — the selected plan id.
- `state.seats` — the seat count (always `>= 1`).
- `state.addons` — `{ <addonId>: true }` for a selected toggle, or
  `{ <addonId>: <qty:number> }` for a qty add-on (`0` = off). Written by replacing
  the object (shallow proxy — no in-place nested mutation).
- `state.billing` — `'monthly'` or `'yearly'`.
- `state.email` / `state.emailError` — the optional email field and its message.

Events on the instance bus:

- `quote` — emitted by `requestQuote()` (and by `emailQuote()`, with an added
  `email` key) with a plain snapshot:
  `{ planId, seats, addons, billing, lineItems, subtotal, discount, total, currency }`.

## The pricing math

All figures are methods, computed on read — nothing derived is stored.

- **`lineItems()`** returns the monthly line items as `[{ id, label, amount }]`:
  the plan base (if non-zero), `seats × perSeat`, and each selected add-on
  (a toggle at its flat price, a qty add-on at `price × quantity`). Off add-ons
  are omitted.
- **`subtotal()`** sums `lineItems()` — the monthly subtotal, before any yearly
  expansion or discount.
- **`discount()`** is `0` on monthly. On yearly it is
  `subtotal × 12 × yearlyDiscount` — the amount the discount removes from a full
  year.
- **`total()`** is the monthly subtotal on monthly billing, or
  `subtotal × 12 − discount` on yearly. `periodLabel()` returns `/ mo` or `/ yr`
  to match.
- **`money(n)`** formats a number through a single cached
  `Intl.NumberFormat(locale, { style: 'currency', currency })`, falling back to a
  plain `CODE 0.00` string if `Intl` or the code is unavailable. `subtotalText()`,
  `discountText()`, and `totalText()` are the formatted readouts the template
  binds.

## Quote, print, and email

- **`requestQuote()`** emits `quote` with the snapshot above. The host decides what
  to do with it — store it, render a server-side PDF, send an email. The component
  does not talk to a server.
- **`printQuote()`** calls `window.print()`. `pricing.css` carries an
  `@media print` block that hides the configurator and the action buttons and
  prints only the quote summary, so the browser's "Save as PDF" produces a clean
  one-page quote. No server is involved in this path. For a branded,
  pixel-controlled PDF, generate it server-side from the emitted `lineItems` /
  `total` instead.
- **Email (optional)** — the email field validates on submit (`emailErrorText()` surfaces the message);
  `emailQuote()` emits
  `quote` with the address bundled in. Wiring the actual send is the host's job —
  the component only validates and hands back the quote.

## Accessibility

The plan cards are a `role="radiogroup"` of `role="radio"` buttons, each carrying
`aria-checked` as the string `"true"`/`"false"` and selectable by click or
Enter/Space. Each add-on toggle is a `role="checkbox"` with a string
`aria-checked` and an `aria-label`; the billing buttons are `role="radio"` with
string `aria-pressed`/`aria-checked`. The seats stepper buttons and the qty
steppers are labelled, and the number input is tied to its section label. The
running total sits in an `aria-live="polite"` region, so it is announced as the
selection changes. Motion respects `prefers-reduced-motion` (tokens zero the
duration).

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

  The selected plan card, the add-on switches, the active billing segment, the
  focus ring, and the primary buttons all follow. The yearly badge and the
  discount row use `--micra-success`; the email error uses `--micra-error`.
- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `pricing.css`. It is yours, including the `@media print`
  quote view.
- **Tailwind (optional)** — the plan cards, toggles, and billing buttons expose
  their state in `aria-checked` / `aria-pressed` (as the strings `"true"` /
  `"false"`), so you can skip `pricing.css` and style with native variants
  (`aria-[checked=true]:`, `aria-pressed:`).

## License

MIT — see `LICENSE` in the repo root.
