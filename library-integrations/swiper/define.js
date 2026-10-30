/*
 * library-integrations/swiper/define.js — Swiper carousel × Micra.
 *
 * A thin reactive wrapper around Swiper (MIT, the <swiper-container> web
 * component). Swiper owns the carousel — touch, momentum, navigation,
 * pagination, keyboard; Micra owns the reactive glue on top — Swiper's active
 * index mirrors into state on every change, so a "Slide X of N" readout and a
 * custom Micra-rendered dot strip both react with no extra wiring. The dot strip
 * also drives Swiper back (click a dot → slideTo), so the binding is two-way.
 * Pair with swiper.css (token skin) and theme/theme.css (tokens).
 *
 * The integration pattern (same for every library wrapper):
 *   onCreate  — find the third-party element, wire its events into state.
 *   onDestroy — remove exactly those listeners (no leaks across htmx/Astro swaps;
 *               Micra.autoCleanup() calls this when the island leaves the DOM).
 *
 * Markup contract (see index.html):
 *   <div data-component="swiper">
 *     <swiper-container navigation="true" pagination="true" loop="true">
 *       <swiper-slide>…</swiper-slide>
 *       …
 *     </swiper-container>
 *     …your reactive UI bound to index / count() / dots()…
 *   </div>
 */
Micra.define('swiper', {
  state: {
    index: 0,   // Swiper's active slide (realIndex — loop-safe), mirrored here
    count: 0,    // total real slides, read once the element is ready
  },

  onCreate() {
    this._el = this.$el.querySelector('swiper-container');
    if (!this._el) return;

    // Pull Swiper's current position into state. With loop enabled, realIndex is
    // the index of the original slide (activeIndex counts the cloned slides), so
    // realIndex is what the readout and dot strip should track. The slide count
    // comes from the authored markup (totalSlides), not Swiper's clone-inclusive
    // list, so it's set once at init below rather than recomputed here.
    this._sync = () => {
      const sw = this._el.swiper;
      if (!sw) return;
      this.state.index = sw.realIndex;
    };

    // swiperslidechange is the native DOM event Swiper Element dispatches for the
    // slideChange event (lowercase, "swiper" prefix). Wired here — not via @event —
    // and torn down in onDestroy: the canonical third-party-library binding.
    this._onChange = () => this._sync();
    this._el.addEventListener('swiperslidechange', this._onChange);

    // Swiper Element upgrades and initializes when it connects — which is BEFORE
    // Micra.start(), so el.swiper may already exist. If it does, read the initial
    // index inline; otherwise swiperinit catches the first ready state.
    this.state.count = this.totalSlides();
    if (this._el.swiper) {
      this._sync();
    } else {
      this._onInit = () => this._sync();
      this._el.addEventListener('swiperinit', this._onInit);
    }
  },

  onDestroy() {
    if (!this._el) return;
    this._el.removeEventListener('swiperslidechange', this._onChange);
    if (this._onInit) this._el.removeEventListener('swiperinit', this._onInit);
  },

  // — derived (methods, never state) ————————————————————————————
  // Count the real slides (the authored <swiper-slide> children), ignoring any
  // loop clones Swiper injects. Used to seed state.count and build the dot strip.
  totalSlides() {
    return this.$el.querySelectorAll('swiper-slide').length;
  },

  // The dot strip is a Micra list, so it needs an array to iterate. Build one
  // entry per real slide, each flagged active when it matches the live index.
  dots() {
    const n = this.state.count || this.totalSlides();
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ key: 'dot-' + i, i, label: 'Slide ' + (i + 1), active: i === this.state.index });
    }
    return out;
  },

  // Human-friendly readout: "Slide 2 of 6".
  position() {
    return 'Slide ' + (this.state.index + 1) + ' of ' + (this.state.count || this.totalSlides());
  },

  // — actions (drive Swiper from Micra UI) ———————————————————————
  prev() {
    if (this._el && this._el.swiper) this._el.swiper.slidePrev();
  },

  next() {
    if (this._el && this._el.swiper) this._el.swiper.slideNext();
  },

  // Jump to a slide from the custom dot strip — the Micra → Swiper direction.
  // Our dots carry the *real* index. Under loop the visible order is shifted by
  // clones, so slideToLoop(realIndex) is the correct call; slideTo would target
  // the raw (clone-inclusive) index. Fall back to slideTo when loop is off.
  goTo(i) {
    const sw = this._el && this._el.swiper;
    if (!sw) return;
    if (sw.params && sw.params.loop) sw.slideToLoop(i);
    else sw.slideTo(i);
  },
});
