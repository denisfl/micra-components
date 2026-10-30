/*
 * components/slider/define.js — Slider (single-thumb range; headless behavior).
 *
 * Pair with slider.css (default skin) and theme/theme.css (tokens). The markup
 * positions the fill width and thumb left from percent() via data-bind style;
 * this file owns the behavior: clamp + step-snap, keyboard (arrows/Home/End),
 * pointer drag (track + thumb), and a 'change' event with the new number.
 *
 * Markup contract:
 *   <div data-component="slider" data-min="0" data-max="100" data-step="1" data-value="40">
 *     <div class="micra-slider" data-ref="track" @pointerdown="dragStart">
 *       <div class="micra-slider__track"></div>
 *       <div class="micra-slider__fill" data-bind="style:fillStyle()"></div>
 *       <div class="micra-slider__thumb" role="slider" tabindex="0"
 *            aria-orientation="horizontal" aria-label="Volume"
 *            data-ref="thumb"
 *            data-bind="style:thumbStyle(),
 *                       aria-valuemin:min, aria-valuenow:value, aria-valuemax:max"
 *            @keydown.right.prevent="increment" @keydown.up.prevent="increment"
 *            @keydown.left.prevent="decrement"  @keydown.down.prevent="decrement"
 *            @keydown.home.prevent="setMin"     @keydown.end.prevent="setMax"></div>
 *     </div>
 *   </div>
 *
 * percent() and the value<->position math are methods, so no field ever holds a
 * derived value. We emit 'change' on every value change (keyboard step and each
 * drag move), not only on commit — the demo shows a live value, and a continuous
 * stream is the more useful contract for a slider. Debounce downstream if needed.
 */
Micra.define('slider', {
  state: { value: 0, min: 0, max: 100, step: 1 },

  onCreate() {
    // prop() auto-casts numerics when a value is present; give sensible defaults.
    this.state.min = this.prop('min', 0);
    this.state.max = this.prop('max', 100);
    this.state.step = this.prop('step', 1) || 1; // guard against a zero step
    this.state.value = this._snap(this.prop('value', this.state.min));
  },

  onDestroy() {
    // Drag listeners live on the document only while a drag is in flight; remove
    // any that lingered (e.g. component torn down mid-drag).
    this._unbindDrag();
  },

  // — keyboard ————————————————————————————————————————————————
  increment() { this._commit(this.state.value + this.state.step); },
  decrement() { this._commit(this.state.value - this.state.step); },
  setMin() { this._commit(this.state.min); },
  setMax() { this._commit(this.state.max); },

  // — pointer drag ————————————————————————————————————————————
  // pointerdown on the track (or thumb, which lives inside it): jump to the
  // pressed position, then track pointermove/pointerup on the DOCUMENT so the
  // drag continues even when the cursor leaves the thumb. Stored on `this` and
  // removed on pointerup and in onDestroy.
  dragStart(e) {
    this._valueFromClientX(e.clientX);
    this._onMove = (ev) => this._valueFromClientX(ev.clientX);
    this._onUp = () => this._unbindDrag();
    document.addEventListener('pointermove', this._onMove);
    document.addEventListener('pointerup', this._onUp);
    if (this.refs.thumb) this.refs.thumb.focus(); // grab focus for keyboard handoff
  },

  // — derived (methods, never state) ——————————————————————————
  // 0..100% of the thumb/fill along the track. Used by the style methods below.
  percent() {
    const { value, min, max } = this.state;
    const span = max - min || 1;
    return ((value - min) / span) * 100 + '%';
  },

  // Inline style objects for the fill width and thumb left. data-bind applies a
  // returned object via Object.assign(el.style, …). NOTE: bind these methods
  // (style:fillStyle()), never an inline object literal (style:{ width: … }) —
  // a {…} in a Micra expression is not an object literal and silently yields no
  // style. Returning a real object from a method is the supported path.
  fillStyle() { return { width: this.percent() }; },
  thumbStyle() { return { left: this.percent() }; },

  // Live value as a string, for data-text in the demo label.
  valueText() {
    return String(this.state.value);
  },

  // — internals ————————————————————————————————————————————————
  _valueFromClientX(clientX) {
    const track = this.refs.track;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    const { min, max } = this.state;
    this._commit(min + ratio * (max - min));
  },

  // Clamp into [min,max] and snap to the nearest step from min.
  _snap(n) {
    const { min, max, step } = this.state;
    const clamped = Math.min(max, Math.max(min, n));
    const snapped = min + Math.round((clamped - min) / step) * step;
    return Math.min(max, Math.max(min, snapped));
  },

  // Write only if the snapped value actually changed; emit the new number.
  _commit(n) {
    const next = this._snap(n);
    if (next === this.state.value) return;
    this.state.value = next;
    this.emit('change', next);
  },

  _unbindDrag() {
    if (this._onMove) document.removeEventListener('pointermove', this._onMove);
    if (this._onUp) document.removeEventListener('pointerup', this._onUp);
    this._onMove = null;
    this._onUp = null;
  },
});
