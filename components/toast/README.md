# Toast

Notification stack driven by a global event. A manager you mount once listens on
the bus; anywhere in your app, `Micra.emit('toast', { message, type })` raises a
toast that auto-dismisses (or the user dismisses it). Toasts queue and stack.
Headless behavior in `define.js`; the look is a default skin in `toast.css` driven
by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="toast.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Mount the manager **once** (anywhere on the page):

   ```html
   <micra-toast>
     <div class="micra-toasts" role="region" aria-label="Notifications" aria-live="polite">
       <template data-each="toasts" data-key="id">
         <div role="status" data-bind="class:toastClass(item)">
           <span data-text="item.message"></span>
           <button @click="dismiss(item.id)" aria-label="Dismiss">&times;</button>
         </div>
       </template>
     </div>
   </micra-toast>
   ```

3. Call `Micra.start()` once, after your components are defined.

4. Raise a toast from anywhere:

   ```js
   Micra.emit('toast', { message: 'Project published.', type: 'success' });
   Micra.emit('toast', { message: 'Something went wrong.', type: 'error', duration: 8000 });
   ```

   `type` is `info` (default), `success`, or `error`. `duration` is the
   auto-dismiss delay in milliseconds (default `4000`).

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Type accent colors** — `theme.css` has no success/error hues, so the skin
  defines its own local variables. Override them to match your palette:

  ```css
  .micra-toast {
    --micra-toast-accent-info: #2563eb;
    --micra-toast-accent-success: #16a34a;
    --micra-toast-accent-error: #dc2626;
  }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `toast.css`. It is yours.
- **Tailwind (optional)** — the type lives in a `micra-toast--{type}` class, so
  you can skip `toast.css` and style with utilities instead.

## Accessibility

The container is a `role="region"` labelled "Notifications" with
`aria-live="polite"`, so new toasts are announced without stealing focus. Each
toast is a `role="status"` and its dismiss button carries `aria-label="Dismiss"`.
Enter motion respects `prefers-reduced-motion` (tokens zero the duration). Every
auto-dismiss timer is cleared on dismiss and on teardown — no stray callbacks.

## License

MIT — see `LICENSE` in the repo root.
