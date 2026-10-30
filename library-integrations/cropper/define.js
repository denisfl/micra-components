/*
 * library-integrations/cropper/define.js — Cropper.js v2 × Micra.
 *
 * A thin reactive wrapper around Cropper.js v2 (MIT). Cropper v2 is a set of
 * web components (<cropper-canvas>, <cropper-image>, <cropper-selection>, …);
 * it owns the cropping — drag, resize, pan, zoom, handles. Micra owns the
 * reactive glue on top — the selection geometry mirrors into state on every
 * change, so a live x/y/width/height readout reacts with no extra wiring, and a
 * "Crop" button turns the current selection into a PNG preview. Pair with
 * cropper.css (token skin) and theme/theme.css (tokens).
 *
 * The integration pattern (same for every library wrapper):
 *   onCreate  — find the third-party element, wire its events into state.
 *   onDestroy — remove exactly those listeners (no leaks across htmx/Astro swaps;
 *               Micra.autoCleanup() calls this when the island leaves the DOM).
 *
 * Markup contract (see index.html):
 *   <div data-component="cropper">
 *     <cropper-canvas>
 *       <cropper-image src="data:…"></cropper-image>
 *       <cropper-shade></cropper-shade>
 *       <cropper-handle action="select"></cropper-handle>
 *       <cropper-selection initial-coverage="0.5" movable resizable>
 *         <cropper-grid></cropper-grid>
 *         <cropper-crosshair></cropper-crosshair>
 *         <cropper-handle action="move"></cropper-handle>
 *         …resize handles…
 *       </cropper-selection>
 *     </cropper-canvas>
 *     …your reactive UI bound to crop / readout() / output…
 *   </div>
 */
Micra.define('cropper', {
  state: {
    // The live selection geometry, mirrored from <cropper-selection>'s change
    // event. A plain object so we always REPLACE it (never mutate nested) —
    // see onCreate. Rounded to whole pixels for a clean readout.
    crop: { x: 0, y: 0, width: 0, height: 0 },
    output: '',     // data: URL of the last crop, drives the preview <img>
    ratio: 'free',  // active aspect-ratio choice ('free' | '1' | '16:9' | '4:3')
  },

  onCreate() {
    this._sel = this.$el.querySelector('cropper-selection');
    if (!this._sel) return;

    // Mirror the selection geometry into state on every change. 'change' is a
    // native event the <cropper-selection> element dispatches with the new
    // geometry on event.detail — wired here (not via @event) and torn down in
    // onDestroy: the canonical third-party-library binding. We REPLACE the whole
    // crop object (Micra re-renders on top-level writes; no nested mutation).
    this._onChange = (e) => {
      const d = (e && e.detail) || this._sel;
      this.state.crop = {
        x: Math.round(d.x || 0),
        y: Math.round(d.y || 0),
        width: Math.round(d.width || 0),
        height: Math.round(d.height || 0),
      };
    };
    this._sel.addEventListener('change', this._onChange);

    // Cropper's elements upgrade and initialize when they connect to the DOM.
    // But Cropper ships as an ES module, and a type="module" script is deferred,
    // so it may run AFTER this classic script + Micra.start() — meaning at this
    // point the <cropper-selection> may still be an un-upgraded plain element
    // with x/y/width/height = 0. Either way our 'change' listener is attached;
    // once Cropper upgrades the element and lays out the initial selection it
    // fires 'change', and state catches up. If the element is already upgraded
    // (custom element defined + it has run its initial render), seed state now so
    // the readout isn't stuck at zero before the first user interaction.
    if (this._isUpgraded()) {
      this._onChange({ detail: this._sel });
    }
  },

  onDestroy() {
    if (this._sel) this._sel.removeEventListener('change', this._onChange);
  },

  // — derived (methods, never state) ————————————————————————————
  // True once Cropper has defined + upgraded the selection element (so reading
  // its geometry is meaningful). $toCanvas only exists on the upgraded element.
  _isUpgraded() {
    return !!(this._sel && typeof this._sel.$toCanvas === 'function');
  },

  // Human-friendly readout of the live selection, e.g. "320 × 180 at (40, 24)".
  readout() {
    const c = this.state.crop;
    return Math.round(c.width) + ' × ' + Math.round(c.height) +
      ' px  at (' + Math.round(c.x) + ', ' + Math.round(c.y) + ')';
  },

  hasOutput() {
    return !!this.state.output;
  },

  // — actions (drive Cropper from Micra UI) ———————————————————————
  // Turn the current selection into a PNG data URL. $toCanvas() (Cropper v2 API)
  // returns a Promise<HTMLCanvasElement> of just the selected region; we read it
  // back as a data: URL into state, which updates the preview <img> reactively.
  async crop() {
    if (!this._isUpgraded()) return;
    const canvas = await this._sel.$toCanvas();
    this.state.output = canvas.toDataURL('image/png');
  },

  // Aspect-ratio toggle. Setting the selection's `aspectRatio` property reflects
  // to the attribute, which makes Cropper reshape the CURRENT selection to the
  // new ratio and re-render (its attributeChangedCallback for aspectRatio calls
  // $change). NaN = free, which clears the constraint. We also fire 'change'
  // ourselves so state.crop catches the reshaped geometry even on the upgrade
  // race (Cropper emits change on the reshape once upgraded; this is a no-op
  // belt-and-suspenders when it already did).
  setRatio(value) {
    this.state.ratio = value;
    if (!this._sel) return;
    const map = { free: NaN, '1': 1, '16:9': 16 / 9, '4:3': 4 / 3 };
    this._sel.aspectRatio = value in map ? map[value] : NaN;
    if (this._isUpgraded()) this._onChange({ detail: this._sel });
  },

  isRatio(value) {
    return this.state.ratio === value;
  },
});
