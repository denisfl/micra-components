# Breadcrumbs

Accessible breadcrumb trail: a labelled `nav` wrapping an ordered list, where the
last crumb is the current page (plain text, `aria-current="page"`) and the rest
are links. Separators are decorative CSS, never in the accessibility tree.
Headless behavior in `define.js`; the look is a default skin in `breadcrumbs.css`
driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="breadcrumbs.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. `state.items` holds `{ id, label, href }`; the **last**
   item is treated as the current page:

   ```html
   <nav data-component="breadcrumbs" aria-label="Breadcrumb">
     <ol class="micra-breadcrumbs">
       <template data-each="items" data-key="id">
         <li class="micra-breadcrumbs__crumb">
           <a class="micra-breadcrumbs__link"
              data-show="!isLast(index)"
              data-bind="href:item.href || '#'"
              @click.prevent="navigate(item.id)"
              data-text="item.label"></a>
           <span class="micra-breadcrumbs__current"
                 data-show="isLast(index)"
                 aria-current="page"
                 data-text="item.label"></span>
         </li>
       </template>
     </ol>
   </nav>
   ```

3. Call `Micra.start()` once, after your components are defined.

Each crumb renders as a link except the last, which renders as plain text marked
`aria-current="page"`. The two are siblings toggled by `isLast(index)`, so exactly
one shows per crumb. Real `href`s work on their own; clicking a crumb also emits a
`navigate` event with the item, so a host can intercept and route in-app — the demo
calls `@click.prevent` and listens with `Micra.on('navigate', …)`.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Change the separator** — it is a CSS `::before` on every crumb but the first.
  Edit one rule:

  ```css
  .micra-breadcrumbs__crumb:not(:first-child)::before { content: '›'; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `breadcrumbs.css`. It is yours.

## Accessibility

The trail is a `nav[aria-label="Breadcrumb"]` wrapping an `<ol>`, so assistive tech
announces it as an ordered navigation landmark. Ancestor crumbs are real links; the
current page is a non-link `<span>` carrying `aria-current="page"`, which is the
WAI-ARIA signal for "you are here". Separators are drawn purely in CSS
(`::before`), so they stay decorative and never reach the accessibility tree — no
`aria-hidden` markup needed.

## License

MIT — see `LICENSE` in the repo root.
