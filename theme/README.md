# Theming Micra components

How Micra components are styled, and how to make them look like yours. This is
the in-depth version of the "Theming model" note in the root `README.md`; the
short version is that you buy the behavior and the looks are a thin, swappable
layer on top.

## Headless behavior + default skin

Every component ships as two files:

- **`define.js`** — the headless behavior. Focus management, keyboard handling,
  ARIA, edge cases, data logic. This is the part that is hard to get right, and
  it is what you are paying for.
- **`<name>.css`** — a default skin. Plain CSS that reads **only** `--micra-*`
  tokens from `theme/theme.css`. It looks finished out of the box, but it owns no
  decisions you can't reverse.

The behavior never depends on the skin. You can keep the default skin, override a
few tokens, or delete `<name>.css` entirely and style from scratch — the
component behaves the same either way.

This is **plain CSS, not a Tailwind bet.** The skin works with vanilla CSS,
Bootstrap, UnoCSS, or whatever you already use. Tailwind is supported and
optional (see below), never required.

Be honest with yourself about scope: each component ships **one** default skin.
Deeper visual variants are yours to build; the templates show a few assembled
screens.

## The token contract

`theme/theme.css` defines the full set of tokens. Skins reference these and
nothing else — no hardcoded color, radius, shadow, or duration ever appears in a
component's CSS. Load `theme.css` once, before any component skin.

| Token | Default (light) | What it controls |
|-------|-----------------|------------------|
| `--micra-bg` | `#faf9f7` | Page background |
| `--micra-surface` | `#ffffff` | Cards, dialogs, menus |
| `--micra-fg` | `#1c1b19` | Primary text |
| `--micra-muted` | `#6b7280` | Secondary text, icons |
| `--micra-border` | `#e5e7eb` | Borders, dividers |
| `--micra-primary` | `#4f46e5` | Accent — buttons, active items |
| `--micra-primary-fg` | `#ffffff` | Text/icon on a primary surface |
| `--micra-ring` | `#4f46e5` | Focus outline |
| `--micra-success` | `#16a34a` | Status accent — success (toasts, alerts, validation) |
| `--micra-warning` | `#d97706` | Status accent — warning |
| `--micra-error` | `#dc2626` | Status accent — error / danger |
| `--micra-overlay` | `rgb(0 0 0 / 0.5)` | Modal backdrop |
| `--micra-radius` | `10px` | Corner rounding |
| `--micra-shadow` | `0 10px 30px rgb(0 0 0 / 0.12)` | Elevation |
| `--micra-duration` | `150ms` | Transition length |
| `--micra-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | Transition easing |

A skin pulls these straight in. From `dropdown.css`:

```css
.micra-dropdown__menu {
  background: var(--micra-surface);
  color: var(--micra-fg);
  border: 1px solid var(--micra-border);
  border-radius: var(--micra-radius);
  box-shadow: var(--micra-shadow);
}
```

Because the skin only ever reads tokens, changing a token changes every component
at once, consistently.

## Re-skinning

Three honest levels, from least to most effort.

### 1. Override tokens globally

Recolor and reshape the whole set by overriding a few tokens on `:root`. This is
the common case — most "make it match our brand" work stops here.

```css
:root {
  --micra-primary: #16a34a;   /* green accent everywhere */
  --micra-primary-fg: #ffffff;
  --micra-radius: 4px;        /* tighter corners */
  --micra-ring: #16a34a;
}
```

No component CSS is touched. The dropdown's active item, the switch's "on" track,
the modal's primary button — all follow.

### 2. Scope tokens to one instance or section

Tokens are regular CSS custom properties, so they cascade. Override them on a
wrapper selector to re-theme just that subtree.

```css
.checkout-panel {
  --micra-primary: #b91c1c;
  --micra-radius: 16px;
}
```

Any Micra component rendered inside `.checkout-panel` picks up the local values;
everything outside keeps the global theme. Useful for a single highlighted
section, a marketing block, or a per-tenant accent.

### 3. Rewrite the component's CSS

When tokens aren't enough — you want a different layout, structure, or visual
language — delete or replace `<name>.css` and write your own. The behavior keeps
working; only the looks change. You own that file.

```css
/* your-switch.css — replaces switch.css entirely */
.micra-switch { /* your geometry, your colors, your transitions */ }
.micra-switch[data-state='checked'] { /* ... */ }
```

You don't have to reference `--micra-*` tokens when you go this route — though
keeping them keeps you consistent with the rest of the theme.

## Dark mode

Dark mode is the same tokens with swapped values. Nothing per-component.

There are two ways it turns on, both already wired in `theme.css`:

- **Explicit** — `[data-theme="dark"]` on `<html>` (or any ancestor) forces dark.
- **Automatic** — `@media (prefers-color-scheme: dark)` applies dark to follow the
  OS, **unless** `[data-theme="light"]` is set to opt out.

```css
[data-theme="dark"] {
  --micra-bg: #0f0f0e;
  --micra-surface: #18181a;
  --micra-fg: #f5f5f4;
  --micra-muted: #9ca3af;
  --micra-border: #2a2a28;
  --micra-overlay: rgb(0 0 0 / 0.6);
  --micra-shadow: 0 10px 30px rgb(0 0 0 / 0.4);
}
```

The toggle the demos use is a one-liner that sets the attribute:

```html
<button onclick="document.documentElement.dataset.theme =
  document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'">
  Toggle theme
</button>
```

Set `data-theme="dark"` or `"light"` to pin a choice; leave it unset to follow
the OS.

## Reduced motion

`theme.css` zeroes `--micra-duration` under `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  :root { --micra-duration: 0ms; }
}
```

Because every skin drives its transitions through that token, motion stops
everywhere with no per-component code. The dropdown still fades open and the
switch thumb still moves to the right position — they just arrive instantly. You
get this for free as long as your own CSS also uses `var(--micra-duration)`.

## The state convention (styling without our CSS)

Components expose their state through attributes, set declaratively via
`data-bind` in the markup. The default skins style off these attributes — and so
can any CSS you write.

- **`data-state`** — `"open" | "closed" | "active" | "checked" | "unchecked" | …`
- **`aria-*`** — `aria-expanded`, `aria-selected`, `aria-checked`, `aria-disabled`

The default skins target them directly. From `dropdown.css`:

```css
.micra-dropdown__menu[data-state='open'] { opacity: 1; visibility: visible; }
.micra-dropdown__item[data-state='active'] { background: var(--micra-primary); }
.micra-dropdown__item[aria-disabled='true'] { color: var(--micra-muted); }
```

And from `switch.css`:

```css
.micra-switch[data-state='checked'] { background: var(--micra-primary); }
```

You can style purely off these attributes without our skin at all.

**Accuracy note on ARIA values.** ARIA state attributes (`aria-expanded`,
`aria-selected`, `aria-checked`, `aria-disabled`) are emitted as the **string**
`"true"` / `"false"`, not as a bare boolean attribute. That's deliberate: it
means CSS attribute selectors like `[aria-selected='true']` and Tailwind's
`aria-selected:` variant match correctly. The switch markup makes this explicit:

```html
data-bind="aria-checked:checked ? 'true' : 'false',
           data-state:checked ? 'checked' : 'unchecked'"
```

## Tailwind (optional, never required)

Because components set `data-state` and `aria-*`, Tailwind v4's native variants
apply directly — no plugin, no config:

```html
<div class="opacity-0 data-[state=open]:opacity-100"></div>
<button class="font-normal aria-[selected=true]:font-semibold"></button>
<button class="aria-expanded:rotate-180"></button>
<span class="data-[state=checked]:bg-indigo-600"></span>
```

This is exactly why ARIA values are emitted as `"true"`/`"false"` strings: the
`aria-[selected=true]:` and `aria-selected:` variants depend on that.

If you go this way, you can skip the component's `<name>.css` and style entirely
with utilities. The behavior doesn't care.

`theme/theme.tailwind.css` ships next to `theme.css` (optional): it maps the
same `--micra-*` tokens into a Tailwind v4 `@theme` block so the tokens become
Tailwind theme values (`bg-micra-primary`, etc.). Treat it as a bonus — it does
not change anything above, and the variants work with or without it.

## How re-skinning travels with a product

Each component folder is self-contained:

```
components/<name>/
  index.html   runnable demo (links theme.css + skin + CDN)
  define.js    behavior
  <name>.css   default skin
  README.md    paste-in guide
```

`theme/theme.css` is the **shared contract**, loaded once for the whole page. So
when a packaged product (a template or a component pack) drops into your project,
it brings its own behavior and skin, and reads the one theme you've already set.
Override tokens once and every component — across every folder — follows.
