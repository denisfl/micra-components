/*
 * library-integrations/filepond/define.js — FilePond file-upload UI × Micra.
 *
 * A thin reactive wrapper around FilePond (MIT, the plain-JS upload library —
 * NOT a web component). FilePond owns the drop area, the previews and the file
 * lifecycle; Micra owns the reactive glue on top. The pond's file list is
 * mirrored into state.files on every add/remove, so a file count, a formatted
 * total size, a custom file list and an empty-state all react with no extra
 * wiring. Pair with filepond.css (token skin) and theme/theme.css (tokens).
 *
 * The integration pattern (same for every library wrapper):
 *   onCreate  — create the FilePond on the <input> ref, wire its events into
 *               state, seed any demo files.
 *   onDestroy — destroy the FilePond instance (no leaks across htmx/Astro swaps;
 *               Micra.autoCleanup() calls this when the island leaves the DOM).
 *
 * Markup contract (see index.html):
 *   <div data-component="filepond">
 *     <input data-ref="input" type="file" multiple />
 *     …your reactive UI bound to state.files / count() / totalSize()…
 *   </div>
 *
 * ── THE STATE-SYNC MODEL ──────────────────────────────────────────────────────
 * FilePond is the source of truth for the actual files (it holds the File
 * objects, the previews, the upload status). We do NOT try to drive FilePond
 * from Micra state — instead, every time FilePond's set of files changes
 * (addfile / removefile / updatefiles) we rebuild a *plain* snapshot array from
 * pond.getFiles() and assign it to state.files. Assigning a new top-level array
 * (never mutating the proxy in place) schedules Micra's keyed re-render, so the
 * count, the total size and the <template data-each="files"> list all update.
 * The remove button calls pond.removeFile(id) — FilePond removes the file and
 * fires removefile, which re-runs the snapshot. One direction, no double-write.
 *
 * No backend: the demo never sets a `server` option, so files are added and
 * previewed locally. The point is the reactive list + the token skin, not a real
 * upload.
 */
Micra.define('filepond', {
  state: {
    // Plain snapshot of the pond's files — the single source of truth for the UI.
    // Each entry: { id, filename, fileSize, status }. Replaced (never mutated in
    // place) whenever FilePond's file set changes.
    files: [],
  },

  onCreate() {
    this._input = this.refs.input;
    if (!this._input || typeof FilePond === 'undefined') return;

    // Optional pre-seed: data-seed on the root is a JSON array of FilePond file
    // descriptors, e.g. [{ "source": "<dataURI>", "options": { "type": "local" } }].
    // Loaded client-side (data URIs need no network), so the demo shows populated
    // files in the sandbox without a server.
    let files = [];
    const seed = this.prop('seed');
    if (seed) {
      try {
        const parsed = JSON.parse(seed);
        if (Array.isArray(parsed)) files = parsed;
      } catch (_) {
        /* ignore malformed seed */
      }
    }

    this._pond = FilePond.create(this._input, {
      credits: false, // hide the "Powered by PQINA" credit
      allowMultiple: true,
      allowReorder: true,
      files,
    });

    // Mirror the pond's files into state on every change. These are custom
    // FilePond events on the instance, so they're wired here (not via @event) and
    // torn down by pond.destroy() in onDestroy — the canonical library binding.
    this._sync = () => {
      this.state.files = this._pond.getFiles().map((f) => ({
        id: f.id,
        filename: f.filename,
        fileSize: f.fileSize, // bytes; may be null until the file is loaded
        status: f.status,
      }));
    };

    this._pond.on('addfile', this._sync);
    this._pond.on('removefile', this._sync);
    this._pond.on('updatefiles', this._sync);

    // Pre-seeded files load asynchronously; updatefiles covers them, but take an
    // initial snapshot too so state isn't empty for a frame.
    this._sync();
  },

  onDestroy() {
    if (this._pond) this._pond.destroy();
    this._pond = null;
  },

  // — derived (methods, never state) ————————————————————————————
  // Number of files currently in the pond.
  count() {
    return this.state.files.length;
  },

  isEmpty() {
    return this.state.files.length === 0;
  },

  // Total size of all files, in bytes (sizes can be null mid-load — treat as 0).
  totalBytes() {
    return this.state.files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
  },

  // Human-readable total, e.g. "1.4 MB". A method, so it recomputes on read.
  totalSize() {
    return this.formatSize(this.totalBytes());
  },

  // Format a byte count as a short human string. Used by totalSize() and per-row.
  formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
  },

  // — actions ——————————————————————————————————————————————————
  // Remove a file by its FilePond id. FilePond fires removefile, which re-runs
  // the snapshot — so we never touch state.files directly here.
  remove(id) {
    if (this._pond) this._pond.removeFile(id);
  },

  // Remove every file (the "Clear all" action).
  clear() {
    if (this._pond) this._pond.removeFiles();
  },
});
