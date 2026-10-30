/*
 * components/formkit/define.js — Form Kit (headless behavior).
 *
 * A schema-driven form: per-field validation, multi-step navigation with a
 * stepper, file upload with a thumbnail preview + a (simulated) progress bar,
 * and debounced autosave to localStorage. Pair with formkit.css (default skin)
 * and theme/theme.css (tokens). The markup renders the CURRENT step's fields
 * from currentFields() via data-each, switching the control by f.type; this
 * file owns everything else.
 *
 * State is a SHALLOW proxy — nested writes go through this.set('path.x', v),
 * which replaces the top-level container under the hood, never mutating a nested
 * object in place. Every derived value — the visible field list, error text,
 * step validity, progress percentages — is a METHOD, never a state field.
 *
 * SCHEMA shape (seeded from a data-schema JSON attr, then REPLACED into state):
 *   { steps: [ { title, fields: [ field… ] } ] }
 * FIELD shape:
 *   { name, label, type, required?, placeholder?, pattern?(string regex),
 *     min?, max?, minLength?, maxLength?, options?([{value,label}]),
 *     help?, rule?(named built-in validator) }
 *   type ∈ text | email | number | password | textarea | select | checkbox
 *         | radio | file
 *
 * Why @input/@change handlers instead of data-model on the value: field names
 * are dynamic (from the schema), so the bound path is built at runtime —
 * onInput(name, $event) writes this.set('values.'+name, v). data-model="value:…"
 * also SKIPS a focused input on re-render, so we never try to push a value back
 * into a field the user is typing in; the input reflects what they typed and
 * state mirrors it. The one place we touch an input imperatively is focusing the
 * first invalid field on a blocked submit (focus only, never value).
 *
 * ARIA values are bound as STRINGS, not bare booleans: aria-required and
 * aria-invalid are 'true'/'false', aria-current is 'step'/'false'. A boolean
 * bind would set/drop the attribute, which is wrong for an ARIA state value.
 *
 * Markup-side note: methods are called with parens in data-text (errorFor(name));
 * a method must not share a name with a state key, or the state key wins in an
 * expression — hence currentFields()/isCurrentStep()/progressPct() etc.
 */
Micra.define('formkit', {
  state: {
    schema: { steps: [] }, // { steps: [ { title, fields: [...] } ] }
    values: {},            // { <fieldName>: value }
    errors: {},            // { <fieldName>: 'message' } — only invalid fields present
    touched: {},           // { <fieldName>: true } — blurred or submit-attempted
    step: 0,               // current step index
    uploads: {},           // { <fieldName>: { name, size, url, progress, done } }
    savedAt: null,         // timestamp of the last autosave, or null
    submitting: false,     // true while a valid submit is in flight
  },

  onCreate() {
    // Autosave key + debounce window. prop() reads data-* attrs via dataset, so a
    // kebab attribute like data-autosave-key is read with its camelCase name.
    // prop() casts a present numeric to a number.
    this._key = this.prop('autosaveKey', '') || '';
    this._debounceMs = this.prop('autosaveDebounce', 800) || 800;

    // Seed the schema from a data-schema JSON attr. prop() hands back the raw
    // string; parse it defensively and REPLACE the schema object.
    const schema = this._parseJSON(this.prop('schema'));
    if (schema && Array.isArray(schema.steps)) this.state.schema = schema;

    // Initialise values from each field's default, then layer any saved draft
    // from localStorage on top (restore). Build the whole object and assign once
    // (shallow proxy — replace the top-level key).
    const values = {};
    this._eachField((f) => {
      values[f.name] = this._defaultFor(f);
    });

    const saved = this._loadSaved();
    if (saved && typeof saved === 'object') {
      for (const k in saved) {
        if (k in values) values[k] = saved[k];
      }
    }
    this.state.values = values;
  },

  onDestroy() {
    // Clear the autosave debounce (null the ref so the cleared state is final).
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    // Clear every simulated-upload interval and revoke its object URL.
    for (const name in this._uploadTimers) this._clearUpload(name);
    for (const name in this.state.uploads) {
      const u = this.state.uploads[name];
      if (u && u.url) URL.revokeObjectURL(u.url);
    }
  },

  // — input ————————————————————————————————————————————————————————
  // Generic value writer for text/email/number/password/textarea/select/radio.
  // Names are dynamic, so we build the nested path and use this.set() (the
  // dot-path setter that keeps the shallow proxy intact).
  onInput(name, e) {
    this.set('values.' + name, e.target.value);
    this._afterChange(name);
  },

  // Checkbox writes a boolean (its .checked), not its .value.
  onCheck(name, e) {
    this.set('values.' + name, !!e.target.checked);
    this._afterChange(name);
  },

  // Mark a field touched (on blur) and validate it so errors surface as the user
  // leaves each field.
  onBlur(name) {
    this.set('touched.' + name, true);
    this.validateField(name);
  },

  // — file upload ——————————————————————————————————————————————————
  // Read the chosen File, build a preview (object URL for images), and kick off a
  // SIMULATED upload that ticks progress 0→100. Swap the simulation for a real
  // XHR with upload.onprogress to wire a true backend (see README).
  onFile(name, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Replacing a previous file: stop its timer and revoke its URL first.
    this._clearUpload(name);
    const prev = this.state.uploads[name];
    if (prev && prev.url) URL.revokeObjectURL(prev.url);

    const isImage = file.type && file.type.indexOf('image/') === 0;
    const url = isImage ? URL.createObjectURL(file) : null;

    // Replace the uploads object (shallow proxy) with this field's entry added.
    this.state.uploads = Object.assign({}, this.state.uploads, {
      [name]: { name: file.name, size: file.size, url, progress: 0, done: false, isImage },
    });

    // Record the File itself as the field value and validate (clears a "required"
    // error once a file is present).
    this.set('values.' + name, file.name);
    this._afterChange(name);

    // Simulated upload: tick every 120ms until 100, then mark done and clear.
    this._uploadTimers = this._uploadTimers || {};
    this._uploadTimers[name] = setInterval(() => {
      const u = this.state.uploads[name];
      if (!u) { this._clearUpload(name); return; }
      const next = Math.min(100, (u.progress || 0) + 10);
      const done = next >= 100;
      this.state.uploads = Object.assign({}, this.state.uploads, {
        [name]: Object.assign({}, u, { progress: next, done }),
      });
      if (done) this._clearUpload(name);
    }, 120);
  },

  // Remove a file: stop its timer, revoke its URL, drop the upload entry, clear
  // the value, and re-validate (a required file field goes invalid again).
  removeFile(name) {
    this._clearUpload(name);
    const u = this.state.uploads[name];
    if (u && u.url) URL.revokeObjectURL(u.url);

    const uploads = Object.assign({}, this.state.uploads);
    delete uploads[name];
    this.state.uploads = uploads;

    // Imperatively clear the file input — gotcha: a file input can't be driven by
    // data-bind, and its .value is restricted; reset via the live element. Field
    // names are dynamic, so we query by the field's id rather than a static ref.
    const input = this.$el.querySelector('#' + this.fieldId(name));
    if (input && 'value' in input) input.value = '';

    this.set('values.' + name, '');
    this._afterChange(name);
  },

  // — multi-step ————————————————————————————————————————————————————
  // Advance only if the current step validates; otherwise mark the step's fields
  // touched and show their errors (the re-render surfaces them).
  next() {
    if (!this.validateStep(this.state.step)) {
      this._touchStep(this.state.step);
      return;
    }
    if (this.state.step < this._lastStep()) this.state.step = this.state.step + 1;
  },

  prev() {
    if (this.state.step > 0) this.state.step = this.state.step - 1;
  },

  // — submit ————————————————————————————————————————————————————————
  // Validate everything; on failure jump to the first step with an error and
  // focus its first invalid field (focus only). On success, flag submitting and
  // emit 'submit' with the values, then clear the flag.
  submit() {
    if (!this.validateAll()) {
      // Mark every field touched so the error messages actually render — hasError
      // gates on touched, and a fresh field the user never visited is untouched.
      this._touchAll();
      const step = this._firstInvalidStep();
      if (step !== -1) this.state.step = step;
      // Focus once the re-render has landed on the target step.
      this.tick().then(() => this._focusFirstInvalid());
      return;
    }
    this.state.submitting = true;
    this.emit('submit', this._plainValues());
    // The host owns persistence; we don't block. Clear the flag next tick so the
    // button's busy state is visible but the form stays usable.
    requestAnimationFrame(() => {
      this.state.submitting = false;
    });
  },

  // — validation ————————————————————————————————————————————————————
  // Validate one field against its rules; write or clear errors[name]. Returns
  // true when valid. Replaces the errors object (shallow proxy) each time.
  validateField(name) {
    const field = this._field(name);
    if (!field) return true;
    const msg = this._ruleError(field, this.state.values[name]);

    const errors = Object.assign({}, this.state.errors);
    if (msg) errors[name] = msg;
    else delete errors[name];
    this.state.errors = errors;
    return !msg;
  },

  // Validate every field on one step; returns true only if all pass. Builds the
  // next errors object in one pass so we write state once.
  validateStep(i) {
    const step = this.state.schema.steps[i];
    if (!step) return true;
    return this._validateFields(step.fields);
  },

  // Validate the whole form across all steps.
  validateAll() {
    const all = [];
    this._eachField((f) => all.push(f));
    return this._validateFields(all);
  },

  // — derived: fields & errors ——————————————————————————————————————
  currentFields() {
    const step = this.state.schema.steps[this.state.step];
    return step ? step.fields : [];
  },

  steps() {
    return this.state.schema.steps;
  },

  hasError(name) {
    return this.isTouched(name) && !!this.state.errors[name];
  },

  errorFor(name) {
    return this.hasError(name) ? this.state.errors[name] : '';
  },

  isTouched(name) {
    return !!this.state.touched[name];
  },

  // — derived: per-type flags (markup switches the control on these) ————
  // A method per control type keeps the template readable: data-if="isText(f)".
  isText(f)     { return ['text', 'email', 'number', 'password'].indexOf(f.type) !== -1; },
  isTextarea(f) { return f.type === 'textarea'; },
  isSelect(f)   { return f.type === 'select'; },
  isCheckbox(f) { return f.type === 'checkbox'; },
  isRadio(f)    { return f.type === 'radio'; },
  isFile(f)     { return f.type === 'file'; },

  // The id wiring: the input id, and the describedby pointing at help + error.
  fieldId(name)     { return 'fk-' + this._uid() + '-' + name; },
  describedBy(f) {
    const ids = [];
    if (f.help) ids.push(this.fieldId(f.name) + '-help');
    ids.push(this.fieldId(f.name) + '-err');
    return ids.join(' ');
  },

  // Current value readout for binding into selects / radios (where data-bind is
  // safe because they aren't free-text-focused the same way). NOTE: not named
  // valueOf — that collides with Object.prototype.valueOf and the expression
  // engine would resolve the prototype method instead of this one.
  fieldValue(name) {
    const v = this.state.values[name];
    return v == null ? '' : v;
  },
  isChecked(name) { return !!this.state.values[name]; },
  // Single-arg: a "name|value" string, because data-bind splits pairs on commas
  // and a two-arg call (a, b) would be torn apart. Used by radio checked binds.
  isRadioOn(pair) {
    const i = pair.indexOf('|');
    const name = pair.slice(0, i);
    const val = pair.slice(i + 1);
    return this.state.values[name] === val;
  },

  // — derived: stepper ——————————————————————————————————————————————
  isCurrentStep(i) { return i === this.state.step; },
  // A step is "done" once we've moved past it AND it still validates.
  isStepDone(i)    { return i < this.state.step && this.stepValid(i); },
  stepValid(i) {
    const step = this.state.schema.steps[i];
    if (!step) return true;
    return step.fields.every((f) => !this._ruleError(f, this.state.values[f.name]));
  },
  // data-state token for a stepper item: done | current | upcoming.
  stepState(i) {
    if (this.isCurrentStep(i)) return 'current';
    if (this.isStepDone(i)) return 'done';
    return 'upcoming';
  },
  stepTitle(i) {
    const step = this.state.schema.steps[i];
    return step ? step.title : '';
  },
  // The current step's title, for the fieldset legend (no-arg: bare `state` is not
  // exposed in expressions, so stepTitle(state.step) would not resolve).
  currentStepTitle() {
    return this.stepTitle(this.state.step);
  },
  // 1-based number shown in the stepper badge.
  stepNumber(i) { return i + 1; },

  isFirstStep() { return this.state.step <= 0; },
  isLastStep()  { return this.state.step >= this._lastStep(); },
  formValid()   { return Object.keys(this.state.errors).length === 0; },

  // Progress across the wizard, 0–100, by completed steps.
  progressPct() {
    const total = this.state.schema.steps.length;
    if (total <= 1) return 100;
    return Math.round((this.state.step / (total - 1)) * 100);
  },
  // Returned style OBJECT (never an inline literal in the expression).
  progressStyle() {
    return { width: this.progressPct() + '%' };
  },

  // — derived: uploads ——————————————————————————————————————————————
  hasUpload(name) { return !!this.state.uploads[name]; },
  upload(name)    { return this.state.uploads[name] || null; },
  uploadProgress(name) {
    const u = this.state.uploads[name];
    return u ? u.progress : 0;
  },
  uploadDone(name) {
    const u = this.state.uploads[name];
    return !!(u && u.done);
  },
  // Per-field progress-bar fill — a method returning an object (gotcha 4).
  uploadStyle(name) {
    return { width: this.uploadProgress(name) + '%' };
  },
  // Human-readable file size for the preview caption.
  fileSize(name) {
    const u = this.state.uploads[name];
    if (!u) return '';
    return this._humanSize(u.size);
  },

  // — derived: autosave indicator ——————————————————————————————————
  isSaved()  { return this.state.savedAt != null; },
  savedNote() {
    if (this.state.savedAt == null) return '';
    const d = new Date(this.state.savedAt);
    return 'Saved ' + d.toLocaleTimeString();
  },

  // — internals ————————————————————————————————————————————————————
  // Called after any value change: re-validate the field if it has been touched
  // (so a fixed error clears as the user types) and schedule an autosave.
  _afterChange(name) {
    if (this.isTouched(name)) this.validateField(name);
    this._scheduleSave();
  },

  // Debounced save: persist plain values to localStorage, stamp savedAt, and
  // emit 'autosave' with the values. The single timer is cleared in onDestroy.
  _scheduleSave() {
    if (!this._key) return;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      const values = this._plainValues();
      try {
        localStorage.setItem(this._key, JSON.stringify(values));
      } catch (e) {
        // Storage may be full or blocked (private mode); autosave is best-effort.
      }
      this.state.savedAt = Date.now();
      this.emit('autosave', values);
    }, this._debounceMs);
  },

  _loadSaved() {
    if (!this._key) return null;
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // Validate a list of fields in one pass, writing errors once. Returns validity.
  _validateFields(fields) {
    const errors = Object.assign({}, this.state.errors);
    let ok = true;
    fields.forEach((f) => {
      const msg = this._ruleError(f, this.state.values[f.name]);
      if (msg) { errors[f.name] = msg; ok = false; }
      else delete errors[f.name];
    });
    this.state.errors = errors;
    return ok;
  },

  // The rule set. Returns an error message string, or '' when the value passes.
  // Order matters: required first, then format/length/range, then any named rule.
  _ruleError(field, value) {
    const isEmpty =
      value == null ||
      value === '' ||
      value === false ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      return (field.label || 'This field') + ' is required';
    }
    // Optional + empty: nothing else to check.
    if (isEmpty) return '';

    const str = String(value);

    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
      return 'Enter a valid email address';
    }
    if (field.minLength != null && str.length < field.minLength) {
      return 'Must be at least ' + field.minLength + ' characters';
    }
    if (field.maxLength != null && str.length > field.maxLength) {
      return 'Must be at most ' + field.maxLength + ' characters';
    }
    if (field.pattern) {
      let re;
      try { re = new RegExp(field.pattern); } catch (e) { re = null; }
      if (re && !re.test(str)) return 'Invalid format';
    }
    if (field.type === 'number') {
      const n = Number(str);
      if (Number.isNaN(n)) return 'Enter a number';
      if (field.min != null && n < field.min) return 'Must be at least ' + field.min;
      if (field.max != null && n > field.max) return 'Must be at most ' + field.max;
    }
    if (field.rule) {
      const fn = this._rules()[field.rule];
      if (fn) {
        const msg = fn(value, this.state.values);
        if (msg) return msg;
      }
    }
    return '';
  },

  // Named, built-in validators referenced by a field's `rule` string. JSON
  // schemas can't carry a function, so a name resolves to one of these. Returned
  // from a METHOD (a bare data property on the define object isn't wired up).
  _rules() {
    return {
      // A strong-ish password: at least one letter and one digit.
      strongPassword: (v) =>
        /[A-Za-z]/.test(String(v)) && /\d/.test(String(v))
          ? ''
          : 'Use letters and numbers',
      // A simple URL shape.
      url: (v) => (/^https?:\/\/\S+$/.test(String(v)) ? '' : 'Enter a valid URL'),
    };
  },

  // Mark every field on a step touched (used when Next is blocked) so the errors
  // become visible. Replace the touched object (shallow proxy) once.
  _touchStep(i) {
    const step = this.state.schema.steps[i];
    if (!step) return;
    const touched = Object.assign({}, this.state.touched);
    step.fields.forEach((f) => { touched[f.name] = true; });
    this.state.touched = touched;
  },

  // Mark every field across all steps touched (used on a blocked submit) so all
  // error messages surface. Replace the touched object once (shallow proxy).
  _touchAll() {
    const touched = Object.assign({}, this.state.touched);
    this._eachField((f) => { touched[f.name] = true; });
    this.state.touched = touched;
  },

  _firstInvalidStep() {
    const steps = this.state.schema.steps;
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].fields.every((f) => !this._ruleError(f, this.state.values[f.name]))) {
        return i;
      }
    }
    return -1;
  },

  // Focus the first invalid field on the current step (focus only — never set
  // its value). Falls back to a query if no ref is registered for that name.
  _focusFirstInvalid() {
    const step = this.state.schema.steps[this.state.step];
    if (!step) return;
    const bad = step.fields.find((f) => this._ruleError(f, this.state.values[f.name]));
    if (!bad) return;
    // Field ids are dynamic, so query by id rather than a static data-ref.
    const el = this.$el.querySelector('#' + this.fieldId(bad.name));
    if (el && el.focus) el.focus();
  },

  // Stop + forget a simulated-upload interval for one field.
  _clearUpload(name) {
    this._uploadTimers = this._uploadTimers || {};
    if (this._uploadTimers[name]) {
      clearInterval(this._uploadTimers[name]);
      delete this._uploadTimers[name];
    }
  },

  // A plain (non-proxy) snapshot of the values for emit/save. File fields persist
  // only their filename — a File object can't be JSON-serialised.
  _plainValues() {
    const out = {};
    for (const k in this.state.values) out[k] = this.state.values[k];
    return out;
  },

  _defaultFor(f) {
    if (f.default !== undefined) return f.default;
    if (f.type === 'checkbox') return false;
    return '';
  },

  _field(name) {
    let found = null;
    this._eachField((f) => { if (f.name === name) found = f; });
    return found;
  },

  _eachField(cb) {
    (this.state.schema.steps || []).forEach((step) => {
      (step.fields || []).forEach((f) => cb(f));
    });
  },

  _lastStep() {
    return Math.max(0, this.state.schema.steps.length - 1);
  },

  // A stable id seed per instance, so multiple forms on a page don't collide.
  _uid() {
    if (!this._uidValue) this._uidValue = Math.random().toString(36).slice(2, 8);
    return this._uidValue;
  },

  _humanSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  // prop() hands back the raw JSON string for data-schema; parse defensively (a
  // malformed attr should not crash the component).
  _parseJSON(raw) {
    if (raw == null || raw === '' || typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },
});
