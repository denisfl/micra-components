# Modal

Accessible dialog on a native `<dialog>`: `showModal()` makes the rest of the page
inert, so Tab stays inside; Escape closes; focus moves in and returns to the trigger;
the dialog sits in the top layer above everything. Backdrop click closes, page
scroll is locked while open (CSS `:has()`). Headless behavior in `define.js`; the
look is a default skin in `modal.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="modal.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup (set the title with `data-title`):

   ```html
   <micra-modal data-title="Delete project?">
     <button class="micra-btn" @click="open">Delete project…</button>

     <dialog class="micra-modal" data-ref="dialog" aria-labelledby="m-title"
             @close="closed" @click.self="close">
       <div class="micra-modal__dialog">
         <header class="micra-modal__head">
           <h2 id="m-title" data-text="title"></h2>
           <button class="micra-modal__close" @click="close" aria-label="Close">&times;</button>
         </header>
         <div class="micra-modal__body">
           <p>Your content here.</p>
         </div>
       </div>
     </dialog>
   </micra-modal>
   ```

3. Call `Micra.start()` once, after your components are defined.

Multiple modals on one page work out of the box — each `<micra-modal>`
is an independent instance with its own state.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `modal.css`. It is yours.
- **Tailwind (optional)** — the open state is the dialog's own `[open]`
  attribute, so you can skip `modal.css` and use the `open:` variant:
  `class="… open:grid backdrop:bg-black/50"`.

## Accessibility

A native modal `<dialog>`, labelled by its heading. The browser moves focus to the
first focusable element on open, keeps Tab inside (the page behind is inert), and
closes on Escape; the component returns focus to the button that opened it (Safari
doesn't focus a clicked button, so the browser alone would lose it). `isOpen`
follows the dialog however it closes. Motion respects `prefers-reduced-motion`
(tokens zero the duration); fades use `@starting-style`, and browsers without it
open and close instantly.

## License

MIT — see `LICENSE` in the repo root.
