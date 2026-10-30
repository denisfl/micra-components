/*
 * library-integrations/trix/define.js — Trix rich-text editor × Micra.
 *
 * A thin reactive wrapper around Basecamp's Trix (MIT, the <trix-editor> web
 * component). Trix owns the editing; Micra owns the reactive glue on top — the
 * editor's HTML mirrors into state on every change, so a live preview, a word
 * count, and a dirty / saved flag all react with no extra wiring. Pair with
 * trix.css (token skin) and theme/theme.css (tokens).
 *
 * The integration pattern (same for every library wrapper):
 *   onCreate  — find the third-party element, wire its events into state.
 *   onDestroy — remove exactly those listeners (no leaks across htmx/Astro swaps;
 *               Micra.autoCleanup() calls this when the island leaves the DOM).
 *
 * Markup contract (see index.html):
 *   <div data-component="trix">
 *     <input id="x" type="hidden">
 *     <trix-editor input="x"></trix-editor>
 *     …your reactive UI bound to html / wordCount() / isDirty()…
 *   </div>
 *
 * Optional: data-seed="<p>…</p>" on the root seeds initial content once.
 */
Micra.define('trix', {
  state: {
    html: '',       // the editor's current HTML — updated on every edit
    savedHtml: '',   // the last "saved" snapshot, for the dirty flag
  },

  onCreate() {
    this._editor = this.$el.querySelector('trix-editor');
    if (!this._editor) return;

    // Mirror the editor's HTML into state on every change. trix-change is a
    // custom event on the element, so it's wired here (not via @event) and torn
    // down in onDestroy — the canonical third-party-library binding.
    this._onChange = () => {
      this.state.html = this._editor.value || '';
    };

    // trix-initialize fires once the editor is ready. Seed optional content,
    // then take the initial snapshot so the document starts "saved", not dirty.
    this._onInit = () => {
      const seed = this.prop('seed');
      if (seed && !this._editor.value) this._editor.editor.loadHTML(seed);
      this.state.html = this._editor.value || '';
      this.state.savedHtml = this.state.html;
    };

    this._editor.addEventListener('trix-change', this._onChange);
    this._editor.addEventListener('trix-initialize', this._onInit);

    // Trix initializes when the element connects — which is BEFORE Micra.start(),
    // so trix-initialize may have already fired. If the editor is ready, run the
    // init now; otherwise the listener above catches it.
    if (this._editor.editor) this._onInit();
  },

  onDestroy() {
    if (!this._editor) return;
    this._editor.removeEventListener('trix-change', this._onChange);
    this._editor.removeEventListener('trix-initialize', this._onInit);
  },

  // — derived (methods, never state) ————————————————————————————
  // Strip tags to count words; entities like &nbsp; collapse to spaces.
  wordCount() {
    const text = (this.state.html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    return text.trim().split(/\s+/).filter(Boolean).length;
  },

  isEmpty() {
    return this.wordCount() === 0;
  },

  // Unsaved-changes flag — the editor content differs from the last save.
  isDirty() {
    return this.state.html !== this.state.savedHtml;
  },

  // — actions ——————————————————————————————————————————————————
  // Snapshot the current HTML as "saved". A real app would POST it here first;
  // the host can also listen to the 'save' event for the payload.
  save() {
    this.state.savedHtml = this.state.html;
    this.emit('save', this.state.html);
  },

  clear() {
    if (this._editor) this._editor.editor.loadHTML('');
  },
});
