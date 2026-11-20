# Mini-cart

A shopping cart in a modal side drawer with a multi-step checkout: line items with
quantity steppers, coupon validation, live totals, and a cart → details → review
wizard that blocks advancing on invalid input. The drawer is a native modal
`<dialog>` (inert page behind, focus return, Escape, backdrop click, page scroll
lock). Headless behavior in `define.js`; the look is a default skin in
`minicart.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark): a small store with three
seeded products, quantity controls, the `SAVE10` / `FREESHIP` coupons, the
three-step checkout with validation on the details form, and a `checkout` event
logged to the console on place-order.

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="minicart.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup and seed the cart. Items and the coupon map come from JSON
   `data-*` attributes (set them before `Micra.start()`); prices are in **cents**.

   ```html
   <micra-minicart
        data-currency="$"
        data-shipping="500"
        data-free-over="6000">
     <button class="micra-minicart-trigger" @click="open" aria-label="Open cart">
       Cart
       <span class="micra-minicart-trigger__badge"
             data-if="itemCount() > 0" data-text="itemCount()"></span>
     </button>

     <dialog
       class="micra-minicart"
       data-ref="dialog"
       aria-labelledby="mc-title"
       @close="closed"
       @click.self="close"
     >
       <div class="micra-minicart__panel">
         <!-- stepper, cart / details / review, footer — see index.html -->
       </div>
     </dialog>
   </micra-minicart>

   <script>
     const cart = document.querySelector('[data-component="minicart"]');
     cart.setAttribute('data-items', JSON.stringify([
       { id: 'tee', name: 'Pro T-shirt', price: 2400, qty: 1 },
       { id: 'mug', name: 'Logo Mug',    price: 1200, qty: 2 },
     ]));
     cart.setAttribute('data-coupons', JSON.stringify({
       SAVE10:   { type: 'percent', value: 10 },
       FREESHIP: { type: 'shipping' },
     }));

     Micra.start();

     const mc = Micra.instances().get(cart);
     mc.on('checkout', (order) => console.log('checkout', order));
   </script>
   ```

3. Call `Micra.start()` once, after the component is defined and the item /
   coupon attributes are set.

Multiple carts on one page work out of the box — each `<micra-minicart>`
is an independent instance with its own items, coupon, and step.

## Props

All optional except the items you want in the cart. Set them on the root element.

| Attribute | Type | Notes |
|-----------|------|-------|
| `data-items` | JSON array | `[{ id, name, price, qty }]`. `price` in **cents**; `qty` clamps to ≥ 1. |
| `data-coupons` | JSON object | `{ "CODE": { type, value? } }`. `type` is `percent` (needs `value`) or `shipping`. Codes match case-insensitively. |
| `data-currency` | string | Prefix for formatted money. Default `"$"`. |
| `data-shipping` | number | Flat shipping in cents, applied when the cart has items. Default `0`. |
| `data-free-over` | number | Subtotal (cents, post-discount) at or above which shipping is free. Omit to never waive. |

Money is integer cents end to end; only the display formatter divides by 100, so
there is no floating-point drift in the math.

## State and events

State holds raw data only; every derived value (counts, totals, validity) is a
method.

- `state.items` — `[{ id, name, price, qty }]`. Quantity changes **replace** the
  array (shallow proxy); never mutated in place.
- `state.coupon` — the coupon input's live text (a `data-model` target).
- `state.appliedCoupon` — `{ code, type, value }` once a valid code is applied, or
  `null`. `state.couponError` carries a rejection message.
- `state.step` — `'cart' | 'details' | 'review'`.
- `state.fields` — `{ name, email, address }`, written through
  `this.set('fields.' + name, v)`. `state.errors` / `state.touched` mirror the
  Form Kit pattern (errors render only once a field is touched).
- `state.placed` — `true` after a successful `placeOrder()`.

Events on the instance bus:

- `checkout` — emitted on a valid `placeOrder()` with a plain snapshot:
  `{ items, appliedCoupon, totals: { subtotal, discount, shipping, total }, fields }`
  (totals in cents). The host owns fulfilment.

## Cart math, coupons, and the wizard

- **Line + cart totals** — `lineTotal(item)`, `subtotal()`, `discount()`,
  `shipping()`, and `total()` are methods returning **formatted** strings; their
  `…Value()` siblings (`subtotalValue()`, `totalValue()`, …) return raw cents for
  the emit payload. `itemCount()` sums quantities for the trigger badge.
- **Quantity** — the stepper's −/+ call `dec(id)` / `inc(id)`; the number input
  calls `onQty(id, $event)`. All route through `setQty`, which floors at 1, so an
  empty or junk entry snaps back to 1 on the next render. Removing the last item
  drops you back to the cart step.
- **Coupons** — `applyCoupon()` upper-cases `state.coupon`, looks it up in the
  seeded map, and either sets `appliedCoupon` or a `couponError`. A `percent`
  coupon discounts the subtotal; a `shipping` coupon zeroes shipping. Free
  shipping also kicks in when the post-discount subtotal clears `data-free-over`.
- **Steps** — `toDetails()` refuses an empty cart; `toReview()` validates the
  details form and blocks while it is invalid (marking fields touched so the
  messages appear, then focusing the first invalid field). `placeOrder()`
  re-validates defensively, emits `checkout`, and flips to the success state;
  `reset()` returns to a fresh cart. The stepper exposes
  `data-state="done|current|upcoming"` per step and `aria-current="step"` on the
  active one.

## Drawer mechanics

Same behavior as the Modal and Slide-over, from a native `<dialog>` opened with
`showModal()`:

- Focus moves into the panel on open and returns to the trigger on close.
- `Tab` / `Shift+Tab` stay inside the drawer: the page behind is inert.
- `Escape` closes; a backdrop click closes (`@click.self`); the page is
  scroll-locked while open (`html:has(.micra-minicart[open])` in the skin).
- The panel slides in with `@starting-style`; browsers without it open and close
  instantly.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

  The trigger, primary buttons, stepper, focus ring, and totals all follow.
  Discounts and the "order placed" mark use `--micra-success`; invalid fields,
  coupon errors, and the remove-on-hover use `--micra-error`.
- **Width** — override `--micra-minicart-size` (default `26rem`) on the component
  or globally.
- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `minicart.css`. It is yours.
- **Tailwind (optional)** — the drawer and stepper expose their state in
  `data-state`, so you can skip `minicart.css` and style with native variants
  (`data-[state=open]:`, `data-[state=current]:`).

## Accessibility

The drawer is a native modal `<dialog>`, labelled by its heading; Tab stays inside
because the page behind is inert, focus returns to the trigger, Escape closes. Quantity steppers and the remove
button are labelled (the input's label and the remove button name include the
product name). The coupon and checkout inputs are labelled and carry
`aria-invalid` and `aria-describedby` (as the strings `"true"`/`"false"`) pointing
at their error text. The stepper marks the active step with `aria-current="step"`,
and the totals sit in a polite live region so changes are announced. Motion
respects `prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
