/*
 * library-integrations/glightbox/define.js — GLightbox × Micra.
 *
 * A thin reactive wrapper around GLightbox (MIT, the plain-JS image/video
 * lightbox — NOT a web component). GLightbox owns the overlay, the gallery
 * navigation and the keyboard; Micra owns the data. The thumbnail gallery is
 * rendered from state via <template data-each="images" data-key="id">, so
 * state.images is the single source of truth — add or remove an image and the
 * grid re-renders. The lightbox's own state (open / closed, which slide) is
 * mirrored back into Micra through its event hooks, so a reactive "Viewing image
 * X of N" readout and an "Open gallery" button work with no extra wiring. Pair
 * with glightbox.css (token skin) and theme/theme.css (tokens).
 *
 * The integration pattern (same for every library wrapper):
 *   onCreate  — init GLightbox over the Micra-rendered gallery, wire its events
 *               into state.
 *   onDestroy — destroy the GLightbox instance (no leaks across htmx/Astro swaps;
 *               Micra.autoCleanup() calls this when the island leaves the DOM).
 *
 * Markup contract (see index.html):
 *   <div data-component="glightbox">
 *     <div data-ref="grid">
 *       <template data-each="images" data-key="id">
 *         <a class="glightbox" href="…media…" data-gallery="…" data-type="image"
 *            data-title="…" data-description="…">
 *           <img src="…thumb…" alt="…">
 *         </a>
 *       </template>
 *     </div>
 *     …your reactive UI bound to count() / isOpen() / viewing()…
 *   </div>
 *
 * ── INIT ORDER (the timing trap, and the fix) ─────────────────────────────────
 * GLightbox binds to the anchors that match its `selector` at init time. But the
 * gallery anchors are produced by Micra's <template data-each>, which renders on a
 * BATCHED microtask — it has NOT run yet when this component's onCreate executes
 * synchronously. So if we call GLightbox() in onCreate and stop there, it scans an
 * empty grid and binds zero slides.
 *
 * The fix: init GLightbox in onCreate (so the instance and its event hooks exist),
 * then call lightbox.reload() AFTER the first render has flushed to the DOM. We
 * schedule that with a 0ms setTimeout — a macrotask, which runs after Micra's
 * render microtask, so the .glightbox anchors exist by the time reload() rescans.
 * (We use setTimeout rather than requestAnimationFrame on purpose: rAF is paused
 * in backgrounded tabs, so a gallery mounted while the tab is hidden would never
 * bind. setTimeout still fires.) The same reload() is what you call (via
 * reloadGallery()) whenever you change state.images after init, since GLightbox
 * only rescans on reload.
 */
Micra.define('glightbox', {
  state: {
    // The gallery — the single source of truth for the rendered grid. Each item:
    // { id, href, thumb, title, description }. Replaced (never mutated in place).
    images: [],
    // Lightbox state, mirrored from GLightbox's own events.
    open: false, // is the lightbox overlay showing?
    index: 0, // the 0-based index of the current slide
  },

  onCreate() {
    this._grid = this.refs.grid;
    if (!this._grid || typeof GLightbox === 'undefined') return;

    // Optional seed: data-seed='[{"id":1,"href":"…","thumb":"…","title":"…"}, …]'
    // on the root, loaded once. Otherwise the host sets state.images before
    // Micra.start().
    const seed = this.prop('seed');
    if (seed && this.state.images.length === 0) {
      try {
        const parsed = JSON.parse(seed);
        if (Array.isArray(parsed)) this.state.images = parsed;
      } catch (_) {
        /* ignore malformed seed */
      }
    }

    // Init over the Micra-rendered anchors. The selector matches the .glightbox
    // anchors data-each just produced (see INIT ORDER above).
    this._lightbox = GLightbox({ selector: '.glightbox' });

    // Mirror the lightbox's own state into Micra. These are GLightbox's events,
    // so they're wired here (not via @event) and torn down in onDestroy.
    //
    // For the current slide we read this._lightbox.index — GLightbox's own 0-based
    // pointer, which is always authoritative — rather than an event payload's
    // index (the payloads disagree on numbering between events). Two hooks keep it
    // in sync:
    //   • open               — initial slide when the lightbox is opened.
    //   • slide_before_change — fires on EVERY next/prev navigation, and
    //                           this._lightbox.index already holds the destination
    //                           when it fires, so it's the one reliable nav hook in
    //                           the v3 build. (slide_changed / slide_after_load are
    //                           inconsistent: they skip openAt() and skip revisits
    //                           of already-loaded slides.)
    this._onOpen = () => {
      this.state.open = true;
      this.state.index = this._lightbox.index || 0;
    };
    this._syncIndex = () => {
      this.state.index = this._lightbox.index || 0;
    };
    this._onClose = () => {
      this.state.open = false;
    };

    this._lightbox.on('open', this._onOpen);
    this._lightbox.on('slide_before_change', this._syncIndex);
    this._lightbox.on('close', this._onClose);

    // The data-each rows render on a microtask AFTER this onCreate; rescan once
    // they're in the DOM (a 0ms timeout runs after the render flush, and unlike
    // rAF still fires in a backgrounded tab). See INIT ORDER above.
    this._reloadTimer = setTimeout(() => {
      this._reloadTimer = null;
      if (this._lightbox) this._lightbox.reload();
    }, 0);
  },

  onDestroy() {
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
    if (this._lightbox) this._lightbox.destroy();
    this._lightbox = null;
  },

  // — derived (methods, never state) ————————————————————————————
  // How many images are in the gallery.
  count() {
    return this.state.images.length;
  },

  isOpen() {
    return this.state.open;
  },

  // 1-based position of the current slide, for a human-readable readout.
  position() {
    return this.state.index + 1;
  },

  // "Viewing image 2 of 5" while open; the count while closed.
  viewing() {
    if (this.state.open) return `Viewing image ${this.position()} of ${this.count()}`;
    return `${this.count()} images — click one, or open the gallery`;
  },

  // — actions ——————————————————————————————————————————————————
  // Open the lightbox programmatically (defaults to the first slide).
  openGallery(index) {
    if (!this._lightbox) return;
    this._lightbox.openAt(typeof index === 'number' ? index : 0);
  },

  // Rescan the DOM after the gallery changes. GLightbox binds at init, so newly
  // rendered anchors need a reload to become navigable.
  reloadGallery() {
    if (this._lightbox) this._lightbox.reload();
  },
});
