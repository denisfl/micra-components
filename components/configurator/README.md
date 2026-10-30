# Configurator

A multi-step product configurator: a stepper, single- or multi-select option
groups per step, a rule engine that keeps selections consistent
(`requires` auto-selects, `excludes` deselects, deselects cascade), and a live,
currency-formatted total. Headless behavior in `define.js`; the look is a default
skin in `configurator.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark): a three-step laptop builder —
CPU → Display → Extras — where picking the **4K** display drops the **base** CPU,
the **dock** extra pulls **4K** back in, and the total updates as you go.

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="configurator.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup and seed a config. The config can come from a `data-config`
   JSON attribute (set it before `Micra.start()`), or you can assign
   `instance.state.config` from JS after mount. Set the currency and locale with
   `data-currency` / `data-locale` (defaults `USD` / `en-US`).

   ```html
   <section class="micra-configurator"
            data-component="configurator"
            data-currency="USD"
            data-locale="en-US"
            aria-label="Configure your laptop">
     <!-- stepper, options, summary, footer — see index.html for the full template -->
   </section>

   <script>
     const config = {
       steps: [
         { id: 'cpu', title: 'CPU', options: [
           { id: 'cpu-base', label: 'M-base', price: 0 },
           { id: 'cpu-pro',  label: 'M-pro',  price: 300 },
         ]},
         { id: 'display', title: 'Display', options: [
           { id: 'disp-fhd', label: 'FHD', price: 0 },
           { id: 'disp-4k',  label: '4K',  price: 250, excludes: ['cpu-base'] },
         ]},
         { id: 'extras', title: 'Extras', multi: true, options: [
           { id: 'ex-dock', label: 'Dock', price: 149, requires: ['disp-4k'] },
         ]},
       ],
     };
     const el = document.querySelector('[data-component="configurator"]');
     el.setAttribute('data-config', JSON.stringify(config));

     Micra.start();

     const cfg = Micra.instances().get(el);
     cfg.on('configure', (payload) => console.log('configure', payload));
     cfg.on('change',    (payload) => console.log('change', payload));
   </script>
   ```

3. Call `Micra.start()` once, after the component is defined and the config
   attribute is set.

Multiple configurators on one page work out of the box — each
`<micra-configurator>` is an independent instance with its own state.

## Config

A config is `{ steps: [ step… ] }`. Each step:

| Key | Type | Notes |
|-----|------|-------|
| `id` | string | Unique step key; also the `selections` key. |
| `title` | string | Shown in the stepper and as the step heading. |
| `multi` | bool | `true` = checkbox group (any number); omit = radio (pick one). |
| `optional` | bool | A single-select step may be left empty without blocking. |
| `options` | array | The selectable options (below). |

Each option:

| Key | Type | Notes |
|-----|------|-------|
| `id` | string | **Globally unique** across all steps — `requires`/`excludes` reference these. |
| `label` | string | Shown on the option and in the summary. |
| `price` | number | Added to the total while selected (in the configured currency's major units). |
| `requires` | array | Option ids auto-selected when this one is picked (see below). |
| `excludes` | array | Option ids deselected (and disabled) while this one is selected. |

Option ids must be **globally unique** so a rule can reach across steps (a Display
option can require a CPU option). The component warns to the console on a
collision.

## The rule engine

Every `select` rebuilds the whole selections object immutably and resolves the
rules in order, so selections stay consistent across steps.

- **`excludes` (directional).** Selecting an option deselects every option in its
  own `excludes` list — the option being selected always wins. While it stays
  selected, those excluded options are **disabled** (muted, not clickable) and
  show a short reason naming the blocker. The relation is one-way on purpose: a
  mutual exclusion would deadlock — you could never click the excluded option to
  trigger the swap. In the demo, `disp-4k` has `excludes: ['cpu-base']`, so
  picking 4K drops the base CPU and base goes disabled until you change displays.
- **`requires` (auto-select, recursive).** Selecting an option auto-selects every
  option in its `requires` list, and theirs in turn, across steps. A required
  option that conflicts with the one you just picked is skipped (the explicit
  click wins). In the demo, `ex-dock` requires `disp-4k`, so adding the dock pulls
  4K in (which, via excludes, forces a non-base CPU).
- **Cascade on deselect.** Removing an option (toggling it off, or replacing a
  radio choice) also removes any selected option that `requires` it, directly or
  transitively — to a fixpoint — so a dependent never lingers without its
  dependency. Turning 4K back off removes the dock that required it.

`isSelected(id)`, `isDisabled(id)`, `disabledReason(id)`, and `currentOptions()`
are all methods (state holds only the raw config and the selections map).

## State and events

State is raw data only; everything derived is a method.

- `state.config` — the seeded `{ steps: [...] }`. Replaced once in `onCreate`.
- `state.selections` — `{ stepId: optionId | [optionId…] }`. Rebuilt and replaced
  on every change (the shallow proxy is never mutated in place).
- `state.step` — current step index.
- `state.done` — `true` once the configuration is committed.

Events on the instance bus:

- `change` — emitted on every selection change with
  `{ selections, total }` (`total` in cents).
- `configure` — emitted by `done()` when every required step is satisfied, with
  `{ selections, total, items }`. `total` is a number in major units; `items` is a
  flat list of `{ stepId, stepTitle, id, label, price }`. The host owns the cart.

## Stepper and pricing

- **Stepper** — `next()` advances only when the current step is valid (a
  single-select step needs a choice unless `optional`; a `multi` step is always
  optional); `prev()` steps back; `goTo(i)` jumps from the header but refuses to
  skip a required step. Each step exposes `data-state="done|current|upcoming"` and
  the active one carries `aria-current="step"`. The Next / Add-to-cart buttons set
  `aria-disabled` from `canAdvance()` / `allValid()`.
- **Total** — `total()` sums the price of every selected option and formats it with
  `Intl.NumberFormat` (currency + locale from `data-currency` / `data-locale`).
  Money is summed in cents internally to avoid float drift, and the total lives in
  an `aria-live="polite"` region so it is announced as it changes.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

  The selected option outline, the stepper, the marker fills, the total, and the
  focus ring all follow. A disabled option's note uses `--micra-warning`.
- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `configurator.css`. It is yours.
- **Tailwind (optional)** — options expose their state in `aria-checked` /
  `aria-disabled` and the stepper in `data-state`, so you can skip
  `configurator.css` and style with native variants
  (`aria-[checked=true]:`, `aria-disabled:`, `data-[state=current]:`).

## Accessibility

A single-select group is a `role="radiogroup"` of `role="radio"` options; a
multi-select group is a `role="group"` of `role="checkbox"` options. Each option
carries `aria-checked` and `aria-disabled` as the strings `"true"`/`"false"`, so
CSS attribute selectors and screen readers both read them correctly; a disabled
option also surfaces a visible reason. The stepper marks the active step with
`aria-current="step"`, and the running total sits in an `aria-live="polite"`
region. Motion respects `prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
