/*
 * components/commandpalette/define.js — Command palette (headless behavior).
 *
 * Pair with commandpalette.css (default skin) and theme/theme.css (tokens). A
 * Cmd/Ctrl+K-style launcher: open it, type to fuzzily filter a list of commands,
 * arrow to move the highlight, Enter to run. This file owns the behavior —
 * the global shortcut, the dialog focus trap and focus return, fuzzy matching
 * and ranking, keyboard navigation, and running the chosen command.
 *
 * It is two patterns nested: a modal dialog (overlay, focus trap, focus return,
 * Escape, scroll lock) wrapping a WAI-ARIA combobox (input + listbox, active
 * option tracked by aria-activedescendant). Like the combobox, the active
 * command is tracked by id (state.activeId), never by index — so when the
 * filtered list changes under the user's fingers, the highlight can't drift onto
 * the wrong row. After every keystroke we re-validate activeId against the
 * current filtered() set and reset it to the first match.
 *
 * Markup contract (see README / index.html):
 *   <div data-component="commandpalette" @keydown.escape.window="close" @keydown.tab.window="trapTab" @keydown.meta.k.window.prevent="toggle" @keydown.ctrl.k.window.prevent="toggle" data-commands='[{"id":…,"label":…}]'>
 *     <button @click="open">…</button>
 *     <div class="micra-cmdk" data-bind="data-state:open ? 'open' : 'closed'"
 *          @click.self="close">
 *       <div class="micra-cmdk__panel" role="dialog" aria-modal="true"
 *            aria-label="Command palette" data-ref="panel" tabindex="-1">
 *         <input role="combobox" aria-controls="cmdk-listbox" data-model="query" …>
 *         <ul id="cmdk-listbox" role="listbox"> … </ul>
 *       </div>
 *     </div>
 *   </div>
 */
Micra.define('commandpalette', {
  state: {
    open: false,
    query: '',
    activeId: null,   // id of the highlighted command (tracked by id, not index)
    commands: [],     // [{ id, label, group?, keywords?, hint? }]
  },

  onCreate() {
    // Seed commands from data-commands (JSON array). Replace the array wholesale —
    // never push into it (state is a shallow proxy).
    const raw = this.prop('commands');
    if (raw) this.state.commands = JSON.parse(raw);
  },

  onDestroy() {
    this._setScrollLock(false);
  },

  // — derived (methods, never state) ————————————————————————————
  // Fuzzy filter + rank. A command matches when the query is a (case-insensitive)
  // subsequence of its label or one of its keywords. Results are sorted by score:
  // smaller is better — contiguous runs and early/word-boundary matches win.
  // Empty query → every command, in seed order.
  filtered() {
    const q = this.state.query.trim().toLowerCase();
    if (!q) return this.state.commands;
    const scored = [];
    for (const cmd of this.state.commands) {
      const score = this._score(cmd, q);
      if (score != null) scored.push({ cmd, score });
    }
    // Stable tiebreak by original index so equal scores keep seed order.
    const order = new Map(this.state.commands.map((c, i) => [c.id, i]));
    scored.sort((a, b) => a.score - b.score || order.get(a.cmd.id) - order.get(b.cmd.id));
    return scored.map((s) => s.cmd);
  },

  noResults() {
    return this.filtered().length === 0;
  },

  // True when this command opens a new group header in the current filtered()
  // order — i.e. it is the first item, or its group differs from the row above.
  // Lets the markup print a group label without a separate grouped data structure.
  firstInGroup(item) {
    if (!item.group) return false;
    const f = this.filtered();
    const i = f.findIndex((c) => c.id === item.id);
    return i === 0 || f[i - 1].group !== item.group;
  },

  // The element id of the active command, for aria-activedescendant. Empty string
  // when nothing is active, so the attribute is effectively absent.
  activeDescendant() {
    return this.state.activeId == null ? '' : this._optionId(this.state.activeId);
  },

  // — behavior ——————————————————————————————————————————————————
  toggle() {
    this.state.open ? this.close() : this.open();
  },

  open() {
    if (this.state.open) return;
    this._trigger = document.activeElement; // remember who opened it
    this.state.query = '';
    this.state.activeId = this._firstId();
    this.state.open = true;
    this._setScrollLock(true);
    // Move focus into the input once it is actually visible. A double rAF waits
    // until the open styles have applied (a single one can fire too early, while
    // the panel is still inheriting visibility:hidden, and focus() no-ops).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (this.refs.input) this.refs.input.focus();
        else if (this.refs.panel) this.refs.panel.focus();
      })
    );
  },

  close() {
    if (!this.state.open) return;
    this.state.open = false;
    this._setScrollLock(false);
    if (this._trigger && this._trigger.focus) this._trigger.focus(); // return focus
    // Opened by the shortcut with nothing focused, there is no trigger to return
    // to; don't leave focus on the now-hidden input, or the next open can't focus it.
    const panel = this.refs.panel;
    if (panel && panel.contains(document.activeElement)) document.activeElement.blur();
  },

  // Fires on every keystroke. data-model also updates state.query from this same
  // event, but listener order isn't guaranteed — so we set query from the event
  // ourselves before recomputing, guaranteeing the highlighted command matches
  // the freshly filtered list the user sees. Reset to the first match.
  onInput(e) {
    this.state.query = e.target.value;
    this.state.activeId = this._firstId();
  },

  next() {
    this.state.activeId = this._step(1);
    this._scrollActiveIntoView();
  },

  prev() {
    this.state.activeId = this._step(-1);
    this._scrollActiveIntoView();
  },

  // Enter runs the active command (if any). Bound to @keydown.enter.
  run() {
    if (this.state.activeId != null) this.choose(this.state.activeId);
  },

  choose(id) {
    const cmd = this.state.commands.find((c) => c.id === id);
    if (!cmd) return;
    this.emit('run', cmd);
    this.close();
  },

  setActive(id) {
    this.state.activeId = id; // hover follows the pointer
  },

  // — internals ————————————————————————————————————————————————
  // Stable per-command element id, used for aria-activedescendant targeting.
  _optionId(id) {
    return 'cmdk-option-' + id;
  },

  _firstId() {
    const f = this.filtered();
    return f.length ? f[0].id : null;
  },

  // Next/prev command id within filtered(), wrapping. Resilient to the active id
  // having fallen out of the filtered set (then we land on the first command).
  _step(dir) {
    const f = this.filtered();
    if (!f.length) return null;
    const i = f.findIndex((c) => c.id === this.state.activeId);
    if (i === -1) return f[0].id;
    const n = (i + dir + f.length) % f.length;
    return f[n].id;
  },

  // Subsequence score against a command's label and keywords. Returns the best
  // (lowest) score across all searchable fields, or null when the query isn't a
  // subsequence of any of them. The per-field scorer rewards contiguous runs and
  // early matches, so "set" ranks "Settings" above "Reset password".
  _score(cmd, q) {
    const fields = [cmd.label || ''];
    if (Array.isArray(cmd.keywords)) fields.push(...cmd.keywords);
    else if (cmd.keywords) fields.push(String(cmd.keywords));
    let best = null;
    for (const field of fields) {
      const s = this._fieldScore(field.toLowerCase(), q);
      if (s != null && (best == null || s < best)) best = s;
    }
    return best;
  },

  // Greedy subsequence match. Penalize the index of the first hit (later start =
  // worse) and every gap between consecutive matched characters (non-contiguous =
  // worse). Returns null if q is not a subsequence of text.
  _fieldScore(text, q) {
    let ti = 0;
    let score = 0;
    let prev = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const ch = q[qi];
      const found = text.indexOf(ch, ti);
      if (found === -1) return null;
      if (qi === 0) score += found;            // how late the match starts
      else if (found > prev + 1) score += (found - prev); // gap penalty
      prev = found;
      ti = found + 1;
    }
    return score;
  },

  // Keep the highlighted command visible when navigating a scrollable listbox.
  // A render is scheduled on the activeId write; tick() resolves after it lands, so the
  // [data-state="active"] row exists by the time we scroll it into view.
  async _scrollActiveIntoView() {
    await this.tick();
    const el = this.$el.querySelector('[role="option"][data-state="active"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  },

  // — focus trap ————————————————————————————————————————————————
  // Tab cycles within the panel; the input and any visible options participate.
  // Called from the root's @keydown.tab.window; a no-op while closed.
  trapTab(e) {
    if (!this.state.open) return;
    const panel = this.refs.panel;
    if (!panel) return;
    const f = this._focusables(panel);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  },

  _focusables(root) {
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  },

  _setScrollLock(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  },
});
