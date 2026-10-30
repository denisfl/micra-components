# Modal

Accessible dialog: focus trap, focus return to the trigger, Escape to close,
backdrop click to close, body scroll lock. Headless behavior in `define.js`; the
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
   <micra-modal @keydown.escape.window="close" @keydown.tab.window="trapTab" data-title="Delete project?">
     <button class="micra-btn" @click="open">Delete project…</button>

     <div class="micra-modal"
          data-bind="data-state:isOpen ? 'open' : 'closed'"
          @click.self="close">
       <div class="micra-modal__dialog" role="dialog" aria-modal="true"
            aria-labelledby="m-title" data-ref="dialog" tabindex="-1">
         <header class="micra-modal__head">
           <h2 id="m-title" data-text="title"></h2>
           <button class="micra-modal__close" @click="close" aria-label="Close">&times;</button>
         </header>
         <div class="micra-modal__body">
           <p>Your content here.</p>
         </div>
       </div>
     </div>
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
- **Tailwind (optional)** — the state lives in `data-state`, so you can skip
  `modal.css` and style with native variants instead:
  `class="… data-[state=open]:opacity-100"`.

## Accessibility

`role="dialog"` + `aria-modal`, labelled by the heading. Focus moves into the
dialog on open and returns to the trigger on close; Tab is trapped inside;
Escape closes. Motion respects `prefers-reduced-motion` (tokens zero the
duration). The backdrop is non-interactive when closed (`visibility: hidden`).

## License

MIT — see `LICENSE` in the repo root.
