/*
 * components/progress/define.js — Progress bar (WAI-ARIA progressbar; read-only).
 *
 * Pair with progress.css (default skin) and theme/theme.css (tokens). The markup
 * positions the fill width from percent() via data-bind style; this file owns the
 * behavior: clamp value into [min,max], expose percent()/valueText() as methods,
 * and a small setValue/inc/dec API the demo drives. A read-only display — there is
 * no keyboard or pointer interaction, just the ARIA contract and the value math.
 *
 * Markup contract (determinate):
 *   <div data-component="progress" data-min="0" data-max="100" data-value="40">
 *     <div class="micra-progress" role="progressbar" aria-label="Upload"
 *          data-bind="aria-valuemin:min, aria-valuenow:value, aria-valuemax:max">
 *       <div class="micra-progress__track">
 *         <div class="micra-progress__fill" data-bind="style:barStyle()"></div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Markup contract (indeterminate): add data-indeterminate="true". The wrapper then
 * carries data-state="indeterminate" (so the skin runs the sliding keyframe) and
 * aria-busy="true" with NO aria-valuenow — see onCreate.
 *
 * percent() and barStyle() are methods, never state — no field holds a derived
 * value. The fill width is bound via barStyle() returning a real object; binding an
 * inline object literal (style:{ width: … }) silently yields no style in Micra, so
 * the method-returning-object form is the supported path (Object.assign onto style).
 */
Micra.define('progress', {
  state: { value: 0, min: 0, max: 100 },

  onCreate() {
    // prop() auto-casts numerics when a value is present; give sensible defaults.
    this.state.min = this.prop('min', 0);
    this.state.max = this.prop('max', 100);
    this.state.value = this._clamp(this.prop('value', 0));
  },

  // — derived (methods, never state) ——————————————————————————
  // A bare data-indeterminate is "" (falsy), so test against false explicitly:
  // present-and-not-"false" means indeterminate.
  isIndeterminate() {
    return this.prop('indeterminate', false) !== false;
  },

  // 0..100% of the fill along the track. Used by barStyle() below.
  percent() {
    const { value, min, max } = this.state;
    const span = max - min || 1;
    return ((value - min) / span) * 100 + '%';
  },

  // Inline style object for the fill width. data-bind applies a returned object via
  // Object.assign(el.style, …). NOTE: bind this method (style:barStyle()), never an
  // inline object literal (style:{ width: … }) — a {…} in a Micra expression is not
  // an object literal and silently yields no style. A real object from a method is
  // the supported path.
  barStyle() {
    return { width: this.percent() };
  },

  // Live percentage as a string, for data-text in the demo label.
  valueText() {
    const { value, min, max } = this.state;
    const span = max - min || 1;
    return Math.round(((value - min) / span) * 100) + '%';
  },

  // — public API (the demo drives these) ——————————————————————
  setValue(n) {
    const next = this._clamp(n);
    if (next === this.state.value) return;
    this.state.value = next;
    this.emit('change', next);
  },

  inc(d) { this.setValue(this.state.value + (d || 0)); },
  dec(d) { this.setValue(this.state.value - (d || 0)); },

  // — internals ————————————————————————————————————————————————
  _clamp(n) {
    const { min, max } = this.state;
    return Math.min(max, Math.max(min, n));
  },
});
