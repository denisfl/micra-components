# FilePond — file upload integration

A thin reactive wrapper around [FilePond](https://pqina.nl/filepond/) (PQINA's MIT
file-upload library — the plain-JS one you apply to an `<input type="file">`, not a
web component). FilePond owns the drop area, the previews and the file lifecycle;
Micra mirrors its file list into state, so a file count, a formatted total size, a
custom file list and an empty-state all react with no extra code — and a token skin
makes FilePond match your theme, including dark mode.

Open `index.html` to see it running (light + dark).

We sell the **glue** — reactive binding, the token skin, clean teardown — not a fork
of FilePond. FilePond loads from a CDN and stays FilePond.

## Use it

1. Load the tokens, FilePond's stylesheet (and the free image-preview plugin's CSS),
   this skin, then FilePond's script, Micra, and the wrapper. **Order matters:**
   FilePond's script must run before `Micra.start()` so the global exists.

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/filepond@4/dist/filepond.min.css" />
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/filepond-plugin-image-preview@4/dist/filepond-plugin-image-preview.min.css" />
   <link rel="stylesheet" href="filepond.css" />

   <script src="https://cdn.jsdelivr.net/npm/filepond-plugin-image-preview@4/dist/filepond-plugin-image-preview.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/filepond@4/dist/filepond.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

   The image-preview plugin is **optional** — it just renders thumbnails for image
   files. Register it before `Micra.start()`:

   ```html
   <script>
     FilePond.registerPlugin(FilePondPluginImagePreview);
   </script>
   ```

2. Drop in the markup — a real `<input type="file">` for FilePond to enhance, plus
   any UI bound to the wrapper's reactive state:

   ```html
   <micra-filepond>
     <input data-ref="input" type="file" multiple aria-label="Upload files" />

     <span data-text="count() + ' files'"></span>
     <span data-text="totalSize()"></span>
     <button @click="clear" data-bind="disabled:isEmpty()">Clear all</button>

     <ul data-show="!isEmpty()">
       <template data-each="files" data-key="id">
         <li>
           <span data-text="item.filename"></span>
           <span data-text="formatSize(item.fileSize)"></span>
           <button @click="remove(item.id)">Remove</button>
         </li>
       </template>
     </ul>
     <div data-show="isEmpty()">No files yet.</div>
   </micra-filepond>
   ```

3. Call `Micra.start()` once, after the scripts above.

## What you get

The wrapper exposes:

- `state.files` — a plain snapshot array of the pond's files, rebuilt on every
  `addfile` / `removefile` / `updatefiles`. Each entry is
  `{ id, filename, fileSize, status }`. Render it with
  `<template data-each="files" data-key="id">`.
- `count()` / `isEmpty()` — derived, for counters and disabled/empty states.
- `totalBytes()` / `totalSize()` — the summed size, raw and human-formatted
  (e.g. `"1.4 MB"`). `formatSize(bytes)` formats any byte count (used per-row).
- `remove(id)` — removes one file via `pond.removeFile(id)`; FilePond fires
  `removefile`, which re-syncs `state.files`. `clear()` removes all.

State flows one way: FilePond is the source of truth for the actual files (it holds
the `File` objects and previews); the wrapper snapshots that into `state.files` and
the UI renders from the snapshot.

## Pre-seeding files

Set `data-seed` on the root to a JSON array of FilePond
[file descriptors](https://pqina.nl/filepond/docs/api/instance/properties/#files).
The demo seeds two sample images from tiny inline **data-URI** SVGs with
`type: "local"` (already-uploaded), so files render without a server and without any
remote request:

```html
<micra-filepond
  data-seed='[{"source":"data:image/svg+xml;base64,…","options":{"type":"local","file":{"name":"a.svg","size":612,"type":"image/svg+xml"}}}]'
>
```

In a real app you'd usually seed from your server's URLs instead, or just let the
user add files.

## Uploading to a server

The demo runs **client-only** — it never sets a `server` option, so files are added
and previewed locally (the point is the reactive list + the skin, not a real upload).
To actually upload, pass FilePond a `server` config. The cleanest place is to extend
the options in `define.js`'s `FilePond.create(...)` call, or read an endpoint off a
`data-*` attr. See FilePond's [server docs](https://pqina.nl/filepond/docs/api/server/).
The reactive glue is unchanged — `state.files` still mirrors the pond, and `status`
on each entry reflects the upload progress (use `FilePond.FileStatus` to interpret it).

## Theming

- The skin references only `--micra-*` tokens, so it follows your theme. Recolor by
  overriding tokens — no edits here:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

- **Dark mode** works: the drop panel, labels, file cards and the image-preview clip
  all use tokens. Set `data-theme="dark"` on `<html>` (or rely on the OS preference).
- The "Powered by PQINA" credit is hidden via `credits: false` in `define.js`.
- **Full control** — `filepond.css` is yours; edit it.

## Server fit

FilePond enhances a normal `<input type="file">`, so it drops into a server-rendered
form unchanged. Micra adds the client-side reactivity (count, total size, custom list,
empty-state) on top, with no build step. The wrapper cleans up after itself
(`onCreate` creates the pond and wires its events, `onDestroy` calls
`pond.destroy()`), so it's safe under `Micra.autoCleanup()` when htmx or Astro swaps
the island out.

## Accessibility

Give the `<input>` an `aria-label` (or an associated `<label>`) so the control is
named. FilePond renders accessible drop and browse controls and per-file action
buttons; the token skin keeps focus visible (a ring on the panel and on action
buttons).

## License

FilePond's core and the **image-preview** plugin are **MIT** (PQINA). This wrapper and
skin are MIT too — see `LICENSE` in the repo root. Note: FilePond's **Doka** / **Pintura** image editor is a
paid product — it is **not** used here; only the free MIT image-preview plugin is.
