/*
 * components/datepicker/define.js — Date picker (single date, headless behavior).
 *
 * A WAI-ARIA date-picker dialog (react-aria DatePicker / Headless UI style): a
 * readonly combobox input shows the chosen date and opens a role="dialog" popover
 * containing a role="grid" month calendar. Pair with datepicker.css (default skin)
 * and theme/theme.css (tokens). The markup binds aria-* and data-state via
 * data-bind, so styling and assistive tech react to open/closed, the selected day,
 * today, and roving focus; this file owns the behavior: open/close, grid keyboard
 * navigation across month boundaries, selection, outside-click, and focus moves.
 *
 * Dates live in state as ISO 'YYYY-MM-DD' STRINGS (primitives, shallow-proxy
 * safe) — never Date objects. The calendar grid, the month label, and the input's
 * display string are derived METHODS, recomputed on read, never state fields.
 * The view (viewYear/viewMonth) is the month the grid shows; focusedISO is the day
 * that holds roving tabindex inside the grid. Native Date is used only inside the
 * date-math methods to add/subtract days and split a date — the DOM is queried for
 * the focus target only, never as a source of truth.
 *
 * Markup contract (the root .micra-datepicker wraps ONLY the input and the
 * popover — its position:relative anchors the absolutely-positioned popover under
 * the input; sibling demo content lives outside it):
 *   <div data-component="datepicker" @pointerdown.outside="close" data-value="2026-06-19">
 *     <div class="micra-datepicker">
 *       <input role="combobox" aria-haspopup="dialog" aria-controls="dp-pop"
 *              readonly data-ref="input" data-bind="value:displayValue(),
 *              aria-expanded:open ? 'true' : 'false'"
 *              @click="toggle" @keydown.down.prevent="open" @keydown.escape="close">
 *       <div class="micra-datepicker__popover" id="dp-pop" role="dialog"
 *            data-ref="popover" data-bind="data-state:open ? 'open' : 'closed'"> … </div>
 *     </div>
 *   </div>
 */
Micra.define('datepicker', {
  state: {
    value: null,    // the selected date as 'YYYY-MM-DD', or null
    open: false,
    viewYear: 2000, // year of the month shown in the grid (set in onCreate)
    viewMonth: 0,   // 0–11 month shown in the grid (set in onCreate)
    focusedISO: '', // the date holding roving focus in the grid ('YYYY-MM-DD')
  },

  onCreate() {
    // Seed the selection from data-value (an ISO string reads back verbatim).
    const initial = this.prop('value');
    if (initial !== '' && initial != null) this.state.value = initial;

    // Open the view on the selected month, else on today's month. Roving focus
    // starts on the selected day, else today.
    const anchor = this.state.value || this._todayISO();
    const [y, m] = this._parts(anchor);
    this.state.viewYear = y;
    this.state.viewMonth = m;
    this.state.focusedISO = anchor;
  },


  // — derived (methods, never state) ————————————————————————————
  // The calendar grid: 6 rows × 7 columns covering viewYear/viewMonth, padded
  // with the trailing days of the previous month and the leading days of the
  // next so every row is full. Weeks start on Monday (ISO). Shape:
  //   [{ key: 'w0', days: [ { iso, day, inMonth, today }, … 7 ] }, … 6 ]
  // The outer data-each item is the WEEK; the nested data-each item is the DAY.
  weeks() {
    const first = new Date(this.state.viewYear, this.state.viewMonth, 1);
    // Monday-start offset: getDay() is 0=Sun..6=Sat; map Sun(0)→6, Mon(1)→0, …
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(this.state.viewYear, this.state.viewMonth, 1 - lead);
    const todayISO = this._todayISO();
    const rows = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (w * 7 + d));
        const iso = this._iso(cell);
        days.push({
          iso,
          day: cell.getDate(),
          inMonth: cell.getMonth() === this.state.viewMonth,
          today: iso === todayISO,
        });
      }
      rows.push({ key: 'w' + w, days });
    }
    return rows;
  },

  // "June 2026" — the live label above the grid.
  monthLabel() {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[this.state.viewMonth] + ' ' + this.state.viewYear;
  },

  // The selected date formatted for the input, e.g. "Jun 19, 2026"; '' when none.
  displayValue() {
    if (!this.state.value) return '';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const [y, m, d] = this._parts(this.state.value);
    return months[m] + ' ' + d + ', ' + y;
  },

  isSelected(iso) {
    return iso === this.state.value;
  },

  isToday(iso) {
    return iso === this._todayISO();
  },

  // Per-cell data-state for styling: selected wins over today wins over outside.
  // (Plain in-month days get '' — no special state.) `inMonth` distinguishes
  // out-of-month padding cells, which render muted but stay clickable.
  cellState(day) {
    if (this.isSelected(day.iso)) return 'selected';
    if (day.today) return 'today';
    if (!day.inMonth) return 'outside';
    return '';
  },

  // — behavior ——————————————————————————————————————————————————
  toggle() {
    this.state.open ? this.close() : this.open();
  },

  open() {
    if (this.state.open) return;
    // Anchor roving focus and the view on the selection, else today.
    const anchor = this.state.value || this._todayISO();
    const [y, m] = this._parts(anchor);
    this.state.viewYear = y;
    this.state.viewMonth = m;
    this.state.focusedISO = anchor;
    this.state.open = true;
    this._focusDay();
  },

  close() {
    if (!this.state.open) return;
    this.state.open = false;
    if (this.refs.input && this.refs.input.focus) this.refs.input.focus(); // return focus
  },

  prevMonth() {
    this._shiftView(-1);
  },

  nextMonth() {
    this._shiftView(1);
  },

  // — grid keyboard (handlers on the role="grid" element) ————————————
  moveLeft()  { this._moveFocus(-1); },
  moveRight() { this._moveFocus(1); },
  moveUp()    { this._moveFocus(-7); },
  moveDown()  { this._moveFocus(7); },

  moveWeekStart() {
    // Back up to Monday of the focused week.
    const dow = (new Date(this.state.focusedISO + 'T00:00:00').getDay() + 6) % 7;
    this._moveFocus(-dow);
  },

  moveWeekEnd() {
    // Forward to Sunday of the focused week.
    const dow = (new Date(this.state.focusedISO + 'T00:00:00').getDay() + 6) % 7;
    this._moveFocus(6 - dow);
  },

  movePrevMonth() {
    this._moveFocusMonths(-1);
  },

  moveNextMonth() {
    this._moveFocusMonths(1);
  },

  // Enter / Space commit the day that holds roving focus.
  chooseFocused() {
    this.selectDay(this.state.focusedISO);
  },

  // Click or keyboard commit a specific day. Selecting an out-of-month padding
  // cell also navigates the view to that month (mostly moot since we close).
  selectDay(iso) {
    const [y, m, d] = this._parts(iso);
    this.state.value = iso;
    this.state.focusedISO = iso;
    this.state.viewYear = y;
    this.state.viewMonth = m;
    this.emit('change', { iso, year: y, month: m + 1, day: d }); // month is 1–12
    // close() returns focus to the input, and Micra's value binding skips a
    // focused field — so refresh the readonly display directly here.
    if (this.refs.input) this.refs.input.value = this.displayValue();
    this.close();
  },

  // — internals ————————————————————————————————————————————————
  // Today's date as an ISO string, computed from the browser clock. (Native Date
  // is permitted in components; only workflow scripts forbid it.)
  _todayISO() {
    return this._iso(new Date());
  },

  // A Date → 'YYYY-MM-DD' using LOCAL fields (so midnight-local days never slip a
  // day via UTC). new Date(y, m, d) is always local, matching how we build cells.
  _iso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },

  // 'YYYY-MM-DD' → [year, monthIndex0to11, day]. Parsed off the string so we
  // never depend on the host timezone.
  _parts(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return [y, m - 1, d];
  },

  // Add `delta` days to focusedISO; if the result lands outside the shown month,
  // move the view to follow it. Then move real DOM focus to the new cell.
  _moveFocus(delta) {
    const [y, m, d] = this._parts(this.state.focusedISO);
    const next = new Date(y, m, d + delta);
    this.state.focusedISO = this._iso(next);
    if (next.getMonth() !== this.state.viewMonth || next.getFullYear() !== this.state.viewYear) {
      this.state.viewYear = next.getFullYear();
      this.state.viewMonth = next.getMonth();
    }
    this._focusDay();
  },

  // PageUp/PageDown: same day-of-month in the adjacent month, clamped to that
  // month's length (e.g. Jan 31 → Feb 28). Follows the view and refocuses.
  _moveFocusMonths(delta) {
    const [y, m, d] = this._parts(this.state.focusedISO);
    const targetY = y;
    const targetM = m + delta;
    const lastDay = new Date(targetY, targetM + 1, 0).getDate(); // day 0 of next = last of target
    const next = new Date(targetY, targetM, Math.min(d, lastDay));
    this.state.focusedISO = this._iso(next);
    this.state.viewYear = next.getFullYear();
    this.state.viewMonth = next.getMonth();
    this._focusDay();
  },

  // Prev/next month via the header arrows. Keep the focused day-of-month sensible
  // by clamping it into the new month (so the same cell stays roving-focusable),
  // but do NOT move real focus — the user is browsing, not navigating the grid.
  _shiftView(delta) {
    const targetM = this.state.viewMonth + delta;
    const base = new Date(this.state.viewYear, targetM, 1);
    this.state.viewYear = base.getFullYear();
    this.state.viewMonth = base.getMonth();
    const [, , d] = this._parts(this.state.focusedISO);
    const lastDay = new Date(this.state.viewYear, this.state.viewMonth + 1, 0).getDate();
    this.state.focusedISO = this._iso(new Date(this.state.viewYear, this.state.viewMonth, Math.min(d, lastDay)));
  },

  // Move real DOM focus to the cell that holds roving tabindex (the focused day).
  // A double rAF waits until the re-render lands AND the popover's open styles
  // have been applied — the popover is visibility:hidden until [data-state=open],
  // so a single rAF (or focusing pre-open) can no-op. We query the DOM only for
  // the focus target; the source of truth stays in state.
  _focusDay() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const cell = this.$el.querySelector('[role="gridcell"][tabindex="0"]');
        if (cell) cell.focus();
      })
    );
  },
});
