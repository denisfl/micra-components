# Trix — rich text editor integration

A thin reactive wrapper around [Trix](https://trix-editor.org) (Basecamp's MIT
`<trix-editor>` web component). Trix owns the editing; Micra mirrors its HTML into
state, so a live preview, a word count, and a saved / unsaved flag react with no
extra code — and a token skin makes Trix match your theme (including dark mode,
which Trix's own stylesheet doesn't handle).

Open `index.html` to see it running (light + dark).

We sell the **glue** — reactive binding, the token skin, clean teardown — not a fork
of Trix. Trix loads from a CDN and stays Trix.

## Use it

1. Load the tokens, Trix's stylesheet, this skin, then Trix's script, Micra, and the
   wrapper. **Order matters:** Trix's script must run before `Micra.start()` so the
   `<trix-editor>` element exists.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/trix@2/dist/trix.css" />
   <link rel="stylesheet" href="trix.css" />

   <script src="https://cdn.jsdelivr.net/npm/trix@2/dist/trix.umd.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup — a hidden input Trix writes to, the editor, and any UI bound
   to the wrapper's reactive state:

   ```html
   <micra-trix>
     <input id="post-body" type="hidden" />
     <trix-editor input="post-body" aria-label="Body"></trix-editor>

     <span data-text="wordCount() + ' words'"></span>
     <span data-text="isDirty() ? 'Unsaved' : 'Saved'"></span>
     <button @click="save" data-bind="disabled:!isDirty()">Save</button>

     <div class="trix-content" data-html="html"></div> <!-- live preview -->
   </micra-trix>
   ```

3. Call `Micra.start()` once, after the scripts above.

**Seeding content.** Either set the hidden input's `value` (HTML) — how a server
renders an existing document — or put HTML on `data-seed` on the root and the
wrapper loads it once the editor is ready.

## What you get

The wrapper exposes:

- `state.html` — the editor's HTML, updated on every edit. Bind `data-html="html"`
  for a live preview, or read it on save.
- `wordCount()` / `isEmpty()` — derived, for counters and disabled states.
- `isDirty()` — true when the content differs from the last save; drives an
  "Unsaved changes" indicator and a disabled Save button.
- `save()` — snapshots the current HTML as saved and emits a `save` event with the
  HTML (where you'd `POST` it). `clear()` empties the editor.

## Theming

- The skin references only `--micra-*` tokens, so it follows your theme. Recolor by
  overriding tokens — no edits here:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

- **Dark mode** works: the editor and content use tokens, and Trix's fixed-dark
  toolbar glyphs are inverted under `[data-theme="dark"]` (and the OS preference) so
  they stay visible. Set `data-theme="dark"` on `<html>`.
- **Full control** — `trix.css` is yours; edit it.

## Server fit

Trix posts its HTML through the hidden input with the surrounding form, so it drops
straight into a server-rendered page — Rails Action Text is built on Trix. Micra
adds the client-side reactivity (preview, counts, dirty flag) on top, with no build
step. The wrapper cleans up after itself (`onCreate` wires Trix's events, `onDestroy`
removes them), so it's safe under `Micra.autoCleanup()` when htmx or Astro swaps the
island out.

## Accessibility

Trix renders a real toolbar and a `contenteditable` region; give the editor an
`aria-label` (or label the field). Focus shows a token ring.

## License

Trix is **MIT** (37signals). This wrapper and skin are MIT too — see `LICENSE` in the repo root.
