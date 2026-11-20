/*
 * components/configurator/define.js — Configurator (headless behavior).
 *
 * A multi-step product configurator: a stepper, single- or multi-select option
 * groups per step, a rule engine (requires / excludes) that keeps selections
 * consistent across steps, and a live, currency-formatted total. Pair with
 * configurator.css (default skin) and theme/theme.css (tokens). The markup
 * renders the CURRENT step's options from currentOptions() via data-each; this
 * file owns everything else.
 *
 * State is a SHALLOW proxy — nested writes go through this.set('path.x', v) or a
 * full replace of the top-level key, never an in-place mutation of a nested
 * object. Every derived value — the option list, whether an option is selected /
 * disabled, the per-step validity, the running total — is a METHOD, never a
 * state field.
 *
 * CONFIG shape (seeded from a data-config JSON attr, then REPLACED into state):
 *   { steps: [ {
 *       id, title, multi?(bool),
 *       options: [ { id, label, price,
 *                    requires?:[optionId…], excludes?:[optionId…] } ]
 *   } ] }
 * Option ids are GLOBALLY unique across steps — requires/excludes reference them
 * directly, so a rule can reach across steps (a Display option can require a CPU
 * option). The seed validates this and warns on a collision.
 *
 * SELECTIONS shape (state.selections): { <stepId>: <optionId> | [optionId…] }.
 * A single-select step maps to one id (or is absent when nothing is chosen); a
 * multi-select step maps to an array of ids. Every change rebuilds the whole
 * selections object immutably and assigns it once (shallow proxy — replace, don't
 * mutate).
 *
 * THE RULE ENGINE (resolve order on every select/deselect):
 *   1. Toggle the clicked option in a working copy of selections.
 *   2. excludes — DIRECTIONAL. A freshly SELECTED option deselects every option
 *      listed in its own `excludes`; the option being selected always wins. It
 *      does NOT consider options that name IT — those simply become disabled while
 *      this one stays selected (see isDisabled). Directionality avoids a deadlock:
 *      if the relation were mutual, an excluded option could never be clicked to
 *      trigger the deselect of the option blocking it.
 *   3. requires — a freshly SELECTED option AUTO-SELECTS every option in its
 *      `requires` list (recursively, so a required option's own requires resolve
 *      too). Auto-selected options honour their own excludes as well.
 *   4. Cascade on DESELECT — when an option is removed, any selected option that
 *      `requires` it (directly or transitively) is removed too, so a dependent
 *      never lingers without its dependency.
 *   After resolving we assign the rebuilt selections in one write.
 *
 * isDisabled(id) is derived, not stored: an option is disabled when some
 * currently-selected option lists id in its `excludes`. A disabled option is muted
 * and not clickable, with a short reason naming the option that excludes it. (The
 * declaring option is never disabled by its own target, so the user can always
 * click the declarer to resolve the conflict.)
 *
 * ARIA values are bound as STRINGS, not bare booleans: aria-checked and
 * aria-disabled are 'true'/'false', aria-current is 'step'/'false'. A boolean
 * bind would add/drop the attribute, which is wrong for an ARIA state value.
 *
 * Markup-side note: methods are called with parens in data-text (total());
 * a method must not share a name with a state key, or the state key wins in an
 * expression — hence currentOptions()/isSelected()/stepValid() etc. A two-arg
 * call like select(stepId, opt.id) is fine inside an @click handler (call
 * expressions take multiple args); it is data-BIND pair-splitting on commas that
 * can't take a multi-arg call.
 */
Micra.define('configurator', {
  state: {
    config: { steps: [] }, // { steps: [ { id, title, multi?, options:[…] } ] }
    selections: {},        // { <stepId>: <optionId> | [optionId…] }
    step: 0,               // current step index
    done: false,           // true once the configuration is committed
  },

  onCreate() {
    // Currency for the formatted total. prop() reads data-* via dataset, casting
    // a present numeric to a number; here we keep the raw strings.
    this._currency = this.prop('currency', 'USD') || 'USD';
    this._locale = this.prop('locale', 'en-US') || 'en-US';

    // Seed the config from a data-config JSON attr. An object default makes prop()
    // parse it (a malformed attr falls back to {}); REPLACE the config object.
    const config = this.prop('config', {});
    if (config && Array.isArray(config.steps)) {
      this.state.config = config;
      this._warnDuplicateIds(config);
    }
  },

  // — selection + rules ————————————————————————————————————————————
  // Toggle one option on its step, then resolve excludes / requires / cascade and
  // write the rebuilt selections object once. A disabled option is inert.
  select(stepId, optionId) {
    if (this.state.done) return;
    const step = this._step(stepId);
    if (!step) return;
    if (this.isDisabled(optionId)) return;

    // Work on a plain, deep-ish copy of selections (arrays cloned) so nothing is
    // mutated in place; assign the result at the end.
    let next = this._cloneSelections();

    if (step.multi) {
      const list = Array.isArray(next[stepId]) ? next[stepId] : [];
      const has = list.indexOf(optionId) !== -1;
      next[stepId] = has ? list.filter((id) => id !== optionId) : list.concat(optionId);
      // A toggle-off is a deselect; a toggle-on is a select.
      next = has
        ? this._afterDeselect(next, optionId)
        : this._afterSelect(next, optionId);
    } else {
      const current = next[stepId];
      if (current === optionId) {
        // Clicking the selected radio again clears it (and cascades).
        delete next[stepId];
        next = this._afterDeselect(next, optionId);
      } else {
        next[stepId] = optionId;
        // The replaced option (if any) is an implicit deselect — cascade it too.
        if (current != null) next = this._afterDeselect(next, current);
        next = this._afterSelect(next, optionId);
      }
    }

    this.state.selections = this._prune(next);
    this.emit('change', { selections: this._plainSelections(), total: this._totalCents() });
  },

  // — stepper ————————————————————————————————————————————————————
  // Advance only if the current step is satisfied; a step that requires a choice
  // refuses to move on while empty.
  next() {
    if (this.state.done) return;
    if (!this.stepValid(this.state.step)) return;
    if (this.state.step < this._lastStep()) this.state.step = this.state.step + 1;
  },

  prev() {
    if (this.state.done) return;
    if (this.state.step > 0) this.state.step = this.state.step - 1;
  },

  // Jump straight to a step from the stepper header. Only allow moving to a step
  // we've already satisfied, or one step ahead of the furthest valid run, so the
  // header can't skip a required choice.
  goTo(i) {
    if (this.state.done) return;
    if (i === this.state.step) return;
    if (i < this.state.step) { this.state.step = i; return; }
    // Forward: every step between here and the target must be valid.
    for (let s = this.state.step; s < i; s++) {
      if (!this.stepValid(s)) return;
    }
    this.state.step = i;
  },

  // Commit the configuration: emit 'configure' with selections, total, and a flat
  // item list, and flip to the done state (the summary stays visible).
  done() {
    if (!this.allValid()) return;
    this.state.done = true;
    this.emit('configure', {
      selections: this._plainSelections(),
      total: this._totalCents() / 100,
      items: this.selectedItems(),
    });
  },

  // Reopen for editing after a commit (demo affordance).
  reset() {
    this.state.done = false;
    this.state.step = 0;
  },

  // — derived: options (methods, never state) ——————————————————————
  currentStep() {
    return this.state.config.steps[this.state.step] || null;
  },

  currentStepId() {
    const step = this.currentStep();
    return step ? step.id : '';
  },

  currentStepTitle() {
    const step = this.currentStep();
    return step ? step.title : '';
  },

  currentIsMulti() {
    const step = this.currentStep();
    return !!(step && step.multi);
  },

  // The current step's options. Each is the raw config option; selection /
  // disabled state are queried per option by id in the markup.
  currentOptions() {
    const step = this.currentStep();
    return step ? step.options : [];
  },

  // Is this option currently selected? Works for single (id ===) and multi
  // (id in array) steps by scanning the selection of the option's owning step.
  isSelected(optionId) {
    const stepId = this._stepIdOf(optionId);
    if (stepId == null) return false;
    const sel = this.state.selections[stepId];
    if (Array.isArray(sel)) return sel.indexOf(optionId) !== -1;
    return sel === optionId;
  },

  // Disabled = a currently-selected option lists this one in its `excludes`.
  // Excludes are DIRECTIONAL: the option that declares the exclusion wins, so the
  // listed target is disabled while the declarer is selected. The declarer itself
  // is never disabled by its target — that would deadlock (you could never pick it
  // to trigger the deselect). A selected option is never reported disabled — the
  // user must be able to click it off.
  isDisabled(optionId) {
    if (this.isSelected(optionId)) return false;
    const option = this._option(optionId);
    if (!option) return true;
    return this._selectedIds().some((sid) => {
      const s = this._option(sid);
      return s && (s.excludes || []).indexOf(optionId) !== -1;
    });
  },

  // A short, human reason an option is disabled (shown as a note when easy). Empty
  // string when the option is selectable. Names the selected option that excludes
  // it.
  disabledReason(optionId) {
    if (!this.isDisabled(optionId) || this.isSelected(optionId)) return '';
    const conflict = this._selectedIds().find((sid) => {
      const s = this._option(sid);
      return s && (s.excludes || []).indexOf(optionId) !== -1;
    });
    const label = conflict ? this._labelOf(conflict) : '';
    return label ? 'Requires removing ' + label : 'Unavailable';
  },

  // role token for the option control: radio (single) or checkbox (multi).
  optionRole() {
    return this.currentIsMulti() ? 'checkbox' : 'radio';
  },

  // — derived: pricing ——————————————————————————————————————————
  // Live total across every selected option, formatted as currency. The number
  // crunching is in cents to dodge float drift.
  total() {
    return this._formatCents(this._totalCents());
  },

  // The price of one option, formatted — shown on each option button.
  optionPrice(price) {
    return this._formatCents(Math.round((price || 0) * 100));
  },

  // — derived: stepper ——————————————————————————————————————————
  steps() {
    return this.state.config.steps;
  },

  stepNumber(i) { return i + 1; },
  isCurrentStep(i) { return i === this.state.step; },

  stepTitle(i) {
    const step = this.state.config.steps[i];
    return step ? step.title : '';
  },

  // A step is valid when a required step has a selection. A single-select step is
  // required by default (it must pick one); a multi step is optional (zero extras
  // is a fine configuration). Mark a step optional with `optional: true`.
  stepValid(i) {
    const step = this.state.config.steps[i];
    if (!step) return true;
    if (step.optional || step.multi) return true;
    const sel = this.state.selections[step.id];
    return Array.isArray(sel) ? sel.length > 0 : sel != null;
  },

  // A step is "done" once we've moved past it and it is valid.
  isStepDone(i) { return i < this.state.step && this.stepValid(i); },

  // data-state token for a stepper item: done | current | upcoming.
  stepState(i) {
    if (this.isCurrentStep(i)) return 'current';
    if (this.isStepDone(i)) return 'done';
    return 'upcoming';
  },

  isFirstStep() { return this.state.step <= 0; },
  isLastStep()  { return this.state.step >= this._lastStep(); },

  // Can we leave the current step? (Gates the Next button's disabled state.)
  canAdvance() { return this.stepValid(this.state.step); },

  // Is the whole configuration committable? Every required step satisfied.
  allValid() {
    return this.state.config.steps.every((_, i) => this.stepValid(i));
  },

  // — derived: summary ——————————————————————————————————————————
  // A flat list of the selected options for the final summary + the emit payload:
  // { stepId, stepTitle, id, label, price }.
  selectedItems() {
    const items = [];
    this.state.config.steps.forEach((step) => {
      const sel = this.state.selections[step.id];
      const ids = Array.isArray(sel) ? sel : sel != null ? [sel] : [];
      ids.forEach((id) => {
        const option = (step.options || []).find((o) => o.id === id);
        if (option) {
          items.push({
            stepId: step.id,
            stepTitle: step.title,
            id: option.id,
            label: option.label,
            price: option.price || 0,
          });
        }
      });
    });
    return items;
  },

  hasSelections() { return this.selectedItems().length > 0; },

  isDone() { return this.state.done; },

  // — internals ————————————————————————————————————————————————
  // After a SELECT: pull in `requires` (recursively) and clear anything the new
  // option (and its required options) excludes.
  _afterSelect(selections, optionId) {
    let next = selections;
    next = this._applyExcludes(next, optionId);
    next = this._applyRequires(next, optionId, {});
    return next;
  },

  // After a DESELECT: drop any selected option that requires the removed one,
  // directly or transitively (cascade), so no dependent is left dangling.
  _afterDeselect(selections, optionId) {
    let next = selections;
    let changed = true;
    // Iterate to a fixpoint: removing a dependent can orphan its own dependents.
    while (changed) {
      changed = false;
      const selectedIds = this._idsOf(next);
      for (const sid of selectedIds) {
        const option = this._option(sid);
        if (!option || !option.requires) continue;
        // If this selected option requires something no longer selected, drop it.
        const unmet = option.requires.some(
          (req) => this._idsOf(next).indexOf(req) === -1
        );
        if (unmet) {
          next = this._removeId(next, sid);
          changed = true;
        }
      }
    }
    return next;
  },

  // Clear every option listed in `optionId`'s `excludes` from selections. Excludes
  // are DIRECTIONAL — the option being selected wins and drops the options it
  // names; it does not consider options that name IT (those simply become disabled
  // while this one is selected, via isDisabled).
  _applyExcludes(selections, optionId) {
    const option = this._option(optionId);
    if (!option || !option.excludes) return selections;
    let next = selections;
    option.excludes.forEach((exId) => {
      if (this._idsOf(next).indexOf(exId) !== -1) next = this._removeId(next, exId);
    });
    return next;
  },

  // Auto-select every option in `optionId`'s requires, recursively. `seen` guards
  // against cycles. Required options honour excludes (the explicit click wins, so
  // a required option that conflicts with the clicked one is simply not added).
  _applyRequires(selections, optionId, seen) {
    if (seen[optionId]) return selections;
    seen[optionId] = true;
    const option = this._option(optionId);
    if (!option || !option.requires) return selections;
    let next = selections;
    option.requires.forEach((reqId) => {
      const req = this._option(reqId);
      if (!req) return;
      // Skip a required option that conflicts with what we just selected.
      if ((option.excludes || []).indexOf(reqId) !== -1) return;
      next = this._addId(next, reqId);
      next = this._applyExcludes(next, reqId);
      next = this._applyRequires(next, reqId, seen);
    });
    return next;
  },

  // — selection-object helpers (immutable; never mutate a nested array) ——
  // Add an option id to its owning step's selection (single → set, multi → push).
  _addId(selections, optionId) {
    const stepId = this._stepIdOf(optionId);
    if (stepId == null) return selections;
    const step = this._step(stepId);
    const next = Object.assign({}, selections);
    if (step && step.multi) {
      const list = Array.isArray(next[stepId]) ? next[stepId] : [];
      if (list.indexOf(optionId) === -1) next[stepId] = list.concat(optionId);
    } else {
      next[stepId] = optionId;
    }
    return next;
  },

  // Remove an option id from its owning step's selection.
  _removeId(selections, optionId) {
    const stepId = this._stepIdOf(optionId);
    if (stepId == null) return selections;
    const next = Object.assign({}, selections);
    const sel = next[stepId];
    if (Array.isArray(sel)) {
      next[stepId] = sel.filter((id) => id !== optionId);
    } else if (sel === optionId) {
      delete next[stepId];
    }
    return next;
  },

  // Drop empty entries (an empty multi array, a stray null) so selections stays
  // tidy for emit + equality.
  _prune(selections) {
    const next = {};
    for (const stepId in selections) {
      const sel = selections[stepId];
      if (Array.isArray(sel)) {
        if (sel.length) next[stepId] = sel.slice();
      } else if (sel != null) {
        next[stepId] = sel;
      }
    }
    return next;
  },

  // A deep-ish clone (arrays cloned) so the working copy is safe to build up.
  _cloneSelections() {
    const out = {};
    for (const stepId in this.state.selections) {
      const sel = this.state.selections[stepId];
      out[stepId] = Array.isArray(sel) ? sel.slice() : sel;
    }
    return out;
  },

  // Every selected option id across all steps, from a given selections object.
  _idsOf(selections) {
    const ids = [];
    for (const stepId in selections) {
      const sel = selections[stepId];
      if (Array.isArray(sel)) ids.push.apply(ids, sel);
      else if (sel != null) ids.push(sel);
    }
    return ids;
  },

  // Every currently-selected option id (from live state).
  _selectedIds() {
    return this._idsOf(this.state.selections);
  },

  // — pricing internals ———————————————————————————————————————————
  _totalCents() {
    return this._selectedIds().reduce((sum, id) => {
      const option = this._option(id);
      return sum + (option ? Math.round((option.price || 0) * 100) : 0);
    }, 0);
  },

  _formatCents(cents) {
    const value = cents / 100;
    try {
      return new Intl.NumberFormat(this._locale, {
        style: 'currency',
        currency: this._currency,
      }).format(value);
    } catch (e) {
      // An unknown currency/locale shouldn't crash the total.
      return value.toFixed(2);
    }
  },

  // — lookups ——————————————————————————————————————————————————
  _step(stepId) {
    return this.state.config.steps.find((s) => s.id === stepId) || null;
  },

  // The step id that owns a given option id (options are globally unique).
  _stepIdOf(optionId) {
    const steps = this.state.config.steps;
    for (let i = 0; i < steps.length; i++) {
      if ((steps[i].options || []).some((o) => o.id === optionId)) return steps[i].id;
    }
    return null;
  },

  _option(optionId) {
    const steps = this.state.config.steps;
    for (let i = 0; i < steps.length; i++) {
      const option = (steps[i].options || []).find((o) => o.id === optionId);
      if (option) return option;
    }
    return null;
  },

  _labelOf(optionId) {
    const option = this._option(optionId);
    return option ? option.label : optionId;
  },

  _lastStep() {
    return Math.max(0, this.state.config.steps.length - 1);
  },

  // A plain (non-proxy) snapshot of selections for emit.
  _plainSelections() {
    const out = {};
    for (const stepId in this.state.selections) {
      const sel = this.state.selections[stepId];
      out[stepId] = Array.isArray(sel) ? sel.slice() : sel;
    }
    return out;
  },

  // Warn once if option ids aren't globally unique — requires/excludes resolve by
  // id, so a collision would target the wrong option.
  _warnDuplicateIds(config) {
    const seen = {};
    (config.steps || []).forEach((step) => {
      (step.options || []).forEach((o) => {
        if (seen[o.id]) {
          // eslint-disable-next-line no-console
          console.warn('[configurator] duplicate option id "' + o.id + '" — ids must be globally unique for requires/excludes to resolve.');
        }
        seen[o.id] = true;
      });
    });
  },
});
