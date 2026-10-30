# Pagination

Numbered page navigation with truncation: always shows the first and last page,
a sibling window around the current page, and ellipsis gaps for everything in
between, so the control stays a fixed width. Headless behavior in `define.js`;
the look is a default skin in `pagination.css` driven by `theme/theme.css`
tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="pagination.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup (set the current page and total with `data-page` /
   `data-total`; `data-sibling-count` is optional, default `1`):

   ```html
   <nav class="micra-pagination" data-component="pagination"
        data-page="1" data-total="12" aria-label="Pagination">
     <button class="micra-pagination__nav" type="button" @click="prev"
             data-bind="disabled:atStart(), aria-disabled:atStart() ? 'true' : 'false'">
       Previous
     </button>

     <template data-each="pages()" data-key="key">
       <button class="micra-pagination__item" type="button"
               data-if="item.type === 'page'" @click="select(item.n)"
               data-text="item.n"
               data-bind="aria-current:isCurrent(item.n) ? 'page' : 'false',
                          data-state:isCurrent(item.n) ? 'current' : ''"></button>
       <span class="micra-pagination__gap" data-if="item.type === 'gap'"
             aria-hidden="true">&hellip;</span>
     </template>

     <button class="micra-pagination__nav" type="button" @click="next"
             data-bind="disabled:atEnd(), aria-disabled:atEnd() ? 'true' : 'false'">
       Next
     </button>
   </nav>
   ```

3. Call `Micra.start()` once, after your components are defined.

Selecting a page (or pressing Previous / Next) sets `state.page` and emits a
`change` event with the new page number. Listen for it to load the matching
slice:

```js
Micra.on('change', (page) => loadPage(page));
```

Multiple paginators on one page work out of the box — each
`<micra-pagination>` is an independent instance with its own state.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `pagination.css`. It is yours.
- **Tailwind (optional)** — the current page lives in `data-state`, so you can
  skip `pagination.css` and style with native variants instead:
  `class="… data-[state=current]:bg-indigo-600"`.

## Accessibility

`nav[aria-label="Pagination"]` wraps the control. The current page button is
marked `aria-current="page"`; the others carry `aria-current="false"`. Previous
and Next are real `<button>`s — they get the HTML `disabled` attribute (so they
drop out of the tab order) plus `aria-disabled` at the first and last page.
Ellipsis gaps are non-interactive `<span aria-hidden="true">`, so screen readers
skip them. Motion respects `prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
