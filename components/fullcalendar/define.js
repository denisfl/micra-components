/*
 * components/fullcalendar/define.js — Full Calendar / Scheduler (headless behavior).
 *
 * The biggest component. Pair with fullcalendar.css (default skin) and
 * theme/theme.css (tokens). The markup renders a month grid OR a week time-grid
 * from derived methods via nested data-each; this file owns everything else: the
 * two views, prev/next/today navigation, a basic recurrence engine, overlap
 * (conflict) detection, and an .ics export.
 *
 * Two views, one cursor:
 *   MONTH — a 6×7 day grid built from the cursor's month (the datepicker grid
 *     approach: Monday-start, six full rows, padded with adjacent-month days).
 *     Each cell carries its date plus the day's events PRE-FLATTENED as chips, so
 *     the nested data-each over a day's chips never has to reach the outer cell.
 *   WEEK — the seven days around the cursor as columns, hours as rows. Timed
 *     events are absolutely positioned inside their day column by eventStyle(),
 *     which returns a real { top, height, left, width } object (a METHOD — an
 *     inline style literal in a binding does NOT work). All-day events sit in a
 *     top band. Overlapping events split the column width side by side.
 *
 * Dates live in state as ISO STRINGS (shallow-proxy safe): the cursor is a
 * 'YYYY-MM-DD' day inside the shown range; each event's start/end is an ISO
 * datetime 'YYYY-MM-DDTHH:mm' (or a 'YYYY-MM-DD' date when allDay). Native Date is
 * used only inside the date-math internals to add days/weeks/months and to split a
 * datetime — the DOM is never a source of truth. Every derived value — the grid,
 * the week layout, event placement, the titles, the conflict set — is a METHOD,
 * never a state field.
 *
 * State is a SHALLOW proxy: state.events is REPLACED, never mutated in place
 * (setEvents([...]) ). RESERVED Micra method names (prop/fetch/emit/on/render/
 * destroy/set) are avoided. The per-view derivations are named monthWeeks() /
 * weekColumns() — never `events`, which would shadow state.events in an expression
 * and read the array instead of the method.
 *
 * Markup contract (see index.html):
 *   <div data-component="fullcalendar" data-view="month"
 *        data-events='[{"id":"1","title":"Standup","start":"2026-06-20T09:00",…}]'>
 *     … toolbar (prev/today/next, title, Month/Week toggle, Export .ics) …
 *     <div data-if="isMonth()"> month grid: weeks → days → chips </div>
 *     <div data-if="isWeek()">  week time-grid: hours + day columns + events </div>
 *   </div>
 *
 * Emits:
 *   'create' { date, start? }  — clicking an empty day (month) or empty slot (week)
 *   'select' { id, … }         — clicking an event chip / block
 */
Micra.define('fullcalendar', {
  state: {
    view: 'month',      // 'month' | 'week'
    cursor: '',         // a 'YYYY-MM-DD' day within the shown range (set in onCreate)
    events: [],         // [{ id, title, start, end, allDay?, recur? }] — base events
  },

  onCreate() {
    // The view comes from data-view; default 'month'. (A bare/absent attr reads as
    // "" — falsy — so fall back explicitly rather than trusting prop() to be set.)
    const view = this.prop('view', 'month');
    this.state.view = view === 'week' ? 'week' : 'month';

    // The cursor defaults to today (any day inside the range the title/grid show).
    this.state.cursor = this._todayISO();

    // Events may be seeded as a data-events JSON attribute. An array default makes
    // prop() parse it (a malformed attr falls back to []); REPLACE the array. Host
    // code can also call setEvents() after mount for richer data.
    const events = this.prop('events', []);
    if (Array.isArray(events) && events.length) this.state.events = events;

    // The visible week band starts at this hour and ends at this hour (exclusive
    // labels run startHour..endHour-1). Configurable via data-start-hour /
    // data-end-hour; defaults give a 6:00–22:00 working window.
    this._startHour = this._clampHour(this.prop('startHour', 6), 6);
    this._endHour = this._clampHour(this.prop('endHour', 22), 22);
    if (this._endHour <= this._startHour) { this._startHour = 0; this._endHour = 24; }

    // How many chips a month cell shows before collapsing to "+K more".
    this._chipLimit = this.prop('chipLimit', 3) || 3;

    // Recurrence expansion is capped so a runaway rule can't loop forever.
    this._recurCap = this.prop('recurCap', 366) || 366;
  },

  onDestroy() {
    // No timers and no document-level listeners are registered (all interaction is
    // @event-bound in the markup), so there is nothing to tear down. Present for
    // symmetry and so a future listener has an obvious home.
  },

  // — public API ————————————————————————————————————————————————
  // Replace the whole event set (shallow proxy → assign a new array).
  setEvents(events) {
    this.state.events = Array.isArray(events) ? events : [];
  },

  // Switch view; keep the cursor (the week shown is the one containing it).
  setView(view) {
    this.state.view = view === 'week' ? 'week' : 'month';
  },

  // Jump the cursor to a specific ISO day ('YYYY-MM-DD' or a datetime — the date
  // part is taken).
  goTo(iso) {
    if (typeof iso !== 'string' || !iso) return;
    this.state.cursor = iso.slice(0, 10);
  },

  // Reconfigure the week view's visible time band at runtime (hours start..end-1
  // are shown). The band is also config-once via data-start-hour / data-end-hour;
  // this lets the host change it live. It lives outside reactive state, so force a
  // re-render after updating it.
  setHourRange(start, end) {
    this._startHour = this._clampHour(start, 6);
    this._endHour = this._clampHour(end, 22);
    if (this._endHour <= this._startHour) { this._startHour = 0; this._endHour = 24; }
    this.render();
  },

  // — view predicates (markup data-if) ——————————————————————————
  isMonth() { return this.state.view === 'month'; },
  isWeek()  { return this.state.view === 'week'; },

  // aria-pressed STRINGS for the Month/Week toggle (an ARIA state value, not a
  // boolean attribute — bind the string).
  monthPressed() { return this.state.view === 'month' ? 'true' : 'false'; },
  weekPressed()  { return this.state.view === 'week'  ? 'true' : 'false'; },

  // — navigation ————————————————————————————————————————————————
  // prev/next move by month in month view, by week in week view.
  prev() { this._shift(-1); },
  next() { this._shift(1); },

  today() { this.state.cursor = this._todayISO(); },

  // The header title: "June 2026" (month) or "Jun 16 – 22, 2026" (week).
  title() {
    return this.state.view === 'week' ? this.weekTitle() : this.monthTitle();
  },

  monthTitle() {
    const [y, m] = this._parts(this.state.cursor);
    return this._months()[m] + ' ' + y;
  },

  // "Jun 16 – 22, 2026", or "Jun 29 – Jul 5, 2026" across a month boundary.
  weekTitle() {
    const start = this._weekStart(this.state.cursor);
    const end = this._addDays(start, 6);
    const [sy, sm, sd] = this._parts(start);
    const [ey, em, ed] = this._parts(end);
    const left = this._mon()[sm] + ' ' + sd;
    if (sm === em && sy === ey) return left + ' – ' + ed + ', ' + ey;
    return left + ' – ' + this._mon()[em] + ' ' + ed + ', ' + ey;
  },

  // — MONTH VIEW ————————————————————————————————————————————————
  // A 6×7 grid covering the cursor's month, Monday-start, padded with adjacent
  // months. Each DAY cell is pre-flattened with its chips + flags so the inner
  // data-each (over day.chips) is self-contained and never reaches the cell scope.
  //   weeks: [{ key, days: [ { iso, day, today, outside, chips: [...], more, label } ] }]
  //   chip:  { id, title, time, allDay, conflict }   (already this day's slice)
  monthWeeks() {
    if (!this.state.cursor) return []; // the first render runs before onCreate
    const [y, m] = this._parts(this.state.cursor);
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-start offset
    const start = new Date(y, m, 1 - lead);
    const todayISO = this._todayISO();

    // Expand recurrence once across the whole visible grid (42 days), then bucket
    // instances by day so each cell just reads its bucket.
    const gridStart = this._iso(start);
    const gridEnd = this._iso(this._addDaysDate(start, 41));
    const instances = this.expandEvents(gridStart, gridEnd + 'T23:59');
    const conflictIds = this._conflictIdSet(instances);
    const byDay = this._bucketByDay(instances);

    const rows = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const cell = this._addDaysDate(start, w * 7 + d);
        const iso = this._iso(cell);
        const dayEvents = (byDay[iso] || []).slice().sort((a, b) => this._cmpStart(a, b));
        const chips = dayEvents.slice(0, this._chipLimit).map((ev) => ({
          id: ev.id,
          title: ev.title,
          time: ev.allDay ? '' : this._timeLabel(ev.start),
          allDay: !!ev.allDay,
          conflict: conflictIds.has(ev._uid),
        }));
        const hidden = dayEvents.length - chips.length;
        days.push({
          iso,
          day: cell.getDate(),
          today: iso === todayISO,
          outside: cell.getMonth() !== m,
          chips,
          more: hidden > 0 ? '+' + hidden + ' more' : '',
          label: this._dayLabel(iso),
        });
      }
      rows.push({ key: 'w' + w, days });
    }
    return rows;
  },

  // data-state for a month day cell: today wins, then out-of-month padding.
  dayState(day) {
    if (day.today) return 'today';
    if (day.outside) return 'outside';
    return '';
  },

  // data-state for a month chip: conflict wins (it is the loudest), then all-day.
  chipState(chip) {
    if (chip.conflict) return 'conflict';
    if (chip.allDay) return 'allday';
    return '';
  },

  // An accessible name for an event chip / block: title plus its time (or "all
  // day"), so a screen reader hears "Standup, 09:00" not just "Standup".
  chipLabel(chip) {
    const when = chip.allDay ? 'all day' : (chip.time || '');
    return when ? chip.title + ', ' + when : chip.title;
  },

  eventLabel(ev) {
    return ev.time ? ev.title + ', ' + ev.time : ev.title;
  },

  // data-state for a week timed block: 'conflict' when it overlaps a sibling.
  eventState(ev) {
    return ev.conflict ? 'conflict' : '';
  },

  // — WEEK VIEW —————————————————————————————————————————————————
  // The seven day columns around the cursor. Each column is pre-flattened with its
  // all-day events and its positioned timed blocks, so the markup loops columns →
  // (allDay chips | timed blocks) without reaching back out.
  //   columns: [{ key, iso, name, dayNum, today, allDay: [...], timed: [...] }]
  //   timed:   { id, title, time, conflict, style: { top, height, left, width } }
  weekColumns() {
    if (!this.state.cursor) return [];
    const start = this._weekStart(this.state.cursor);
    const todayISO = this._todayISO();
    const rangeStart = start;
    const rangeEnd = this._addDays(start, 6) + 'T23:59';
    const instances = this.expandEvents(rangeStart, rangeEnd);
    const conflictIds = this._conflictIdSet(instances);
    const byDay = this._bucketByDay(instances);

    const cols = [];
    for (let d = 0; d < 7; d++) {
      const iso = this._addDays(start, d);
      const dayEvents = byDay[iso] || [];
      const allDay = dayEvents
        .filter((ev) => ev.allDay)
        .map((ev) => ({ id: ev.id, title: ev.title }));

      const timedSrc = dayEvents
        .filter((ev) => !ev.allDay)
        .sort((a, b) => this._cmpStart(a, b));
      // Side-by-side layout for overlapping timed events: assign each a column
      // lane within its overlap cluster, then width/left split the day column.
      const laid = this._layoutLanes(timedSrc, iso);
      const timed = laid.map((p) => ({
        id: p.ev.id,
        title: p.ev.title,
        time: this._timeRange(p.ev),
        conflict: conflictIds.has(p.ev._uid),
        style: this._blockStyle(p, iso),
      }));

      // Empty-slot click targets: one transparent button per hour, pre-flattened
      // with this column's iso + the hour so the handler carries both (a binding
      // can't reach the outer column scope once the inner data-each rebinds item).
      const slots = [];
      for (let h = this._startHour; h < this._endHour; h++) {
        slots.push({ key: iso + '-' + h, iso, hour: h, label: this._hourLabel(h) });
      }

      const [, , dayNum] = this._parts(iso);
      cols.push({
        key: 'c' + d,
        iso,
        name: this._dow()[d],
        dayNum,
        today: iso === todayISO,
        allDay,
        timed,
        slots,
      });
    }
    return cols;
  },

  // The hour rows down the left rail (e.g. 6:00 … 21:00). Labels only — the column
  // tracks are a CSS background grid so events can be absolutely positioned.
  hourRows() {
    const rows = [];
    for (let h = this._startHour; h < this._endHour; h++) {
      rows.push({ key: 'h' + h, hour: h, label: this._hourLabel(h) });
    }
    return rows;
  },

  // The style object for a timed block: vertical position from start/end (% of the
  // band) and horizontal split from its overlap lane. Returned from a METHOD (gotcha
  // 4: an inline {…} literal in a binding does not work; bind style:item.style).
  // Exposed publicly too so the placement math is unit-testable by direct call.
  eventStyle(ev) {
    // ev here is a raw event; derive a single-lane placement for ad-hoc callers.
    const iso = (ev.start || '').slice(0, 10);
    return this._blockStyle({ ev, lane: 0, lanes: 1 }, iso);
  },

  // — RECURRENCE ————————————————————————————————————————————————
  // Expand the base events into concrete instances overlapping [rangeStart,
  // rangeEnd] (both ISO datetimes; a bare date is treated as that day's 00:00).
  // Non-recurring events pass through unchanged when they overlap. Recurring events
  // (recur:{ freq, interval?, count?, until? }) are stepped from their start until
  // they pass the range end, the count, or the until date — whichever comes first —
  // capped at recurCap iterations so a malformed rule can't loop forever. Each
  // instance carries a stable _uid (base id + occurrence index) used by conflict
  // detection and as a render key.
  expandEvents(rangeStart, rangeEnd) {
    const rs = this._toMs(rangeStart);
    const re = this._toMs(this._endOfRange(rangeEnd));
    const out = [];

    for (const base of this.state.events) {
      if (!base || !base.start) continue;
      if (!base.recur) {
        // Plain event: include it if it overlaps the range at all.
        const evStart = this._toMs(base.start);
        const evEnd = this._toMs(this._eventEnd(base));
        if (evEnd >= rs && evStart <= re) {
          out.push(this._instance(base, base.start, base.end, 0));
        }
        continue;
      }

      // Recurring: walk occurrences from the seed start.
      const recur = base.recur;
      const interval = Math.max(1, recur.interval || 1);
      const durMs = this._toMs(this._eventEnd(base)) - this._toMs(base.start);
      const maxCount = recur.count != null ? recur.count : Infinity;
      const untilMs = recur.until != null ? this._toMs(this._endOfRange(recur.until)) : Infinity;

      let cursor = this._dateOf(base.start);
      let i = 0;
      let emitted = 0;
      while (i < this._recurCap && emitted < maxCount) {
        const occStart = this._iso(cursor) + this._timePart(base.start);
        const occStartMs = this._toMs(occStart);
        if (occStartMs > re || occStartMs > untilMs) break;

        const occEndMs = occStartMs + durMs;
        if (occEndMs >= rs) {
          const occEnd = base.end ? this._fromMs(occEndMs, base.allDay) : null;
          out.push(this._instance(base, occStart, occEnd, emitted));
        }
        emitted++;
        cursor = this._stepRecur(cursor, recur.freq, interval);
        i++;
      }
    }
    return out;
  },

  // — CONFLICT DETECTION ————————————————————————————————————————
  // Two timed events conflict when they fall on the same day and their [start,end)
  // intervals overlap. Returned as pairs of base ids over the CURRENT visible range
  // (month grid or week), so a host can surface a warning. Per-instance flagging in
  // the views uses the same overlap test via _conflictIdSet().
  conflicts() {
    const range = this._visibleRange();
    const instances = this.expandEvents(range.start, range.end).filter((e) => !e.allDay);
    const flagged = this._conflictIdSet(instances);
    const pairs = [];
    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const a = instances[i], b = instances[j];
        if (this._sameDay(a, b) && this._overlap(a, b)) {
          pairs.push({ a: a.id, b: b.id });
        }
      }
    }
    return { pairs, count: pairs.length, ids: [...flagged] };
  },

  // — ICS EXPORT ————————————————————————————————————————————————
  // Build a valid VCALENDAR string and download it via a Blob + object URL + a
  // temporary <a> (the datatable download pattern). Non-recurring events emit one
  // VEVENT each; recurring events emit a single VEVENT carrying an RRULE (FREQ/
  // INTERVAL/COUNT/UNTIL), which calendars expand natively — no pre-expansion. The
  // string itself is returned by buildICS() so the serialization is testable.
  exportICS() {
    const ics = this.buildICS();
    this._download(ics, 'text/calendar;charset=utf-8', 'calendar.ics');
  },

  buildICS() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Micra//Full Calendar//EN',
      'CALSCALE:GREGORIAN',
    ];
    for (const ev of this.state.events) {
      if (!ev || !ev.start) continue;
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + this._uidFor(ev));
      lines.push('DTSTAMP:' + this._icsStamp(this._todayISO() + 'T00:00'));
      lines.push(this._icsDateLine('DTSTART', ev.start, ev.allDay));
      // All-day DTEND is EXCLUSIVE in RFC 5545 (a one-day event ends the next
      // day), so advance the end day by one; timed events keep their real end.
      const end = ev.allDay
        ? this._addDays(this._eventEnd(ev), 1)
        : this._eventEnd(ev);
      lines.push(this._icsDateLine('DTEND', end, ev.allDay));
      lines.push('SUMMARY:' + this._icsText(ev.title || 'Event'));
      const rrule = this._rrule(ev.recur);
      if (rrule) lines.push('RRULE:' + rrule);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // RFC 5545 wants CRLF line breaks.
    return lines.join('\r\n');
  },

  // — interaction (emit to the host) ————————————————————————————
  // Click an empty month cell → ask the host to create on that day.
  createOnDay(iso) {
    this.emit('create', { date: iso });
  },

  // Click an empty week slot → create at that day + hour.
  createAt(iso, hour) {
    const start = iso + 'T' + this._pad(hour) + ':00';
    this.emit('create', { date: iso, start });
  },

  // Click an event chip / block → hand the base id back. We resolve the base event
  // (recurrence instances share their base id) so the host gets the real record.
  selectEvent(id) {
    const ev = this.state.events.find((e) => String(e.id) === String(id));
    this.emit('select', ev ? { ...ev } : { id });
  },

  // — internals: date math ——————————————————————————————————————
  _todayISO() { return this._iso(new Date()); },

  // Date → 'YYYY-MM-DD' from LOCAL fields (so a local midnight never slips a day
  // through UTC). new Date(y, m, d) is local, matching how cells are built.
  _iso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },

  // 'YYYY-MM-DD' (date part of any ISO string) → [year, month0, day], parsed off the
  // string so it never depends on the host timezone.
  _parts(iso) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return [y, m - 1, d];
  },

  // The local Date at midnight for an ISO day/datetime (date part only).
  _dateOf(iso) {
    const [y, m, d] = this._parts(iso);
    return new Date(y, m, d);
  },

  // The 'THH:mm' time part of an ISO datetime, or '' for a bare date.
  _timePart(iso) {
    const t = iso.indexOf('T');
    return t === -1 ? '' : iso.slice(t);
  },

  // Add days to an ISO day, returning an ISO day.
  _addDays(iso, n) {
    const [y, m, d] = this._parts(iso);
    return this._iso(new Date(y, m, d + n));
  },

  _addDaysDate(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  },

  // Monday of the week containing an ISO day.
  _weekStart(iso) {
    const [y, m, d] = this._parts(iso);
    const dow = (new Date(y, m, d).getDay() + 6) % 7; // Mon=0 … Sun=6
    return this._iso(new Date(y, m, d - dow));
  },

  // Move the cursor by one step in the active view's unit: a calendar month in
  // month view (day-of-month clamped into the target month so e.g. Jan 31 → Feb 28
  // doesn't roll over), a week (7 days) in week view.
  _shift(delta) {
    if (this.state.view === 'week') {
      this.state.cursor = this._addDays(this.state.cursor, 7 * delta);
      return;
    }
    const [y, m, d] = this._parts(this.state.cursor);
    const lastDay = new Date(y, m + delta + 1, 0).getDate(); // day 0 of next = last of target
    this.state.cursor = this._iso(new Date(y, m + delta, Math.min(d, lastDay)));
  },

  // Step a recurrence cursor (a midnight Date) by one interval of freq.
  _stepRecur(date, freq, interval) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    if (freq === 'weekly') return new Date(y, m, d + 7 * interval);
    if (freq === 'monthly') return new Date(y, m + interval, d);
    return new Date(y, m, d + interval); // 'daily' (default)
  },

  // An ISO datetime → epoch ms via the LOCAL constructor (a bare date becomes that
  // day's local 00:00). Parsing by parts avoids the UTC interpretation the native
  // Date(string) parser gives a date-only string.
  _toMs(iso) {
    if (!iso) return 0;
    const [datePart, timePart] = iso.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    let hh = 0, mm = 0;
    if (timePart) {
      const [h, min] = timePart.split(':').map(Number);
      hh = h || 0; mm = min || 0;
    }
    return new Date(y, m - 1, d, hh, mm).getTime();
  },

  // epoch ms → ISO datetime (or bare date when allDay).
  _fromMs(ms, allDay) {
    const dt = new Date(ms);
    const date = this._iso(dt);
    if (allDay) return date;
    return date + 'T' + this._pad(dt.getHours()) + ':' + this._pad(dt.getMinutes());
  },

  // An event's end, defaulting to a 1-hour block (timed) or same day (allDay) when
  // no end is given.
  _eventEnd(ev) {
    if (ev.end) return ev.end;
    if (ev.allDay) return ev.start;
    return this._fromMs(this._toMs(ev.start) + 60 * 60 * 1000, false);
  },

  // Inclusive end of a range bound: a bare date means through that day's 23:59.
  _endOfRange(iso) {
    return iso.indexOf('T') === -1 ? iso + 'T23:59' : iso;
  },

  // — internals: bucketing, overlap, layout ————————————————————
  // Map instances to the day(s) they touch. A timed event is bucketed on its start
  // day (week/month cells render it where it begins); an all-day or multi-day event
  // is bucketed on every day it spans within a sane cap.
  _bucketByDay(instances) {
    const byDay = {};
    for (const ev of instances) {
      const startDay = ev.start.slice(0, 10);
      const endDay = this._eventEnd(ev).slice(0, 10);
      if (ev.allDay && endDay > startDay) {
        let day = startDay, guard = 0;
        while (day <= endDay && guard < 400) {
          (byDay[day] = byDay[day] || []).push(ev);
          day = this._addDays(day, 1);
          guard++;
        }
      } else {
        (byDay[startDay] = byDay[startDay] || []).push(ev);
      }
    }
    return byDay;
  },

  // Two instances overlap in time when start_a < end_b and start_b < end_a.
  _overlap(a, b) {
    const as = this._toMs(a.start), ae = this._toMs(this._eventEnd(a));
    const bs = this._toMs(b.start), be = this._toMs(this._eventEnd(b));
    return as < be && bs < ae;
  },

  _sameDay(a, b) {
    return a.start.slice(0, 10) === b.start.slice(0, 10);
  },

  // The set of instance _uids that overlap at least one other timed instance on the
  // same day — used to flag conflicts in both views.
  _conflictIdSet(instances) {
    const timed = instances.filter((e) => !e.allDay);
    const flagged = new Set();
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        if (this._sameDay(timed[i], timed[j]) && this._overlap(timed[i], timed[j])) {
          flagged.add(timed[i]._uid);
          flagged.add(timed[j]._uid);
        }
      }
    }
    return flagged;
  },

  // Greedy lane assignment for a day's timed events (already start-sorted): each
  // event takes the first lane free at its start; the cluster's lane count drives
  // the side-by-side width split. Returns [{ ev, lane, lanes }].
  _layoutLanes(events, iso) {
    const placed = [];
    const laneEnds = []; // end-ms per lane, reset between clusters
    let clusterStart = 0; // index into `placed` where the current cluster began
    let clusterMaxEnd = -Infinity;

    for (const ev of events) {
      const s = this._toMs(ev.start);
      const e = this._toMs(this._eventEnd(ev));
      // A gap with everything so far starts a fresh cluster (lanes reset).
      if (s >= clusterMaxEnd) {
        this._finalizeCluster(placed, clusterStart);
        clusterStart = placed.length;
        laneEnds.length = 0;
        clusterMaxEnd = -Infinity;
      }
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); }
      else laneEnds[lane] = e;
      clusterMaxEnd = Math.max(clusterMaxEnd, e);
      placed.push({ ev, lane, lanes: 1 });
    }
    this._finalizeCluster(placed, clusterStart);
    return placed;
  },

  // Once a cluster is closed, every member shares the cluster's lane count so the
  // width split is uniform across the overlap group.
  _finalizeCluster(placed, from) {
    let lanes = 1;
    for (let i = from; i < placed.length; i++) lanes = Math.max(lanes, placed[i].lane + 1);
    for (let i = from; i < placed.length; i++) placed[i].lanes = lanes;
  },

  // The absolute-position style for a timed block within its day column. Vertical:
  // percent of the visible band [startHour, endHour). Horizontal: the lane split.
  // Clamped so an event running past the band still renders inside the column.
  _blockStyle(p, iso) {
    const ev = p.ev;
    const bandStart = this._toMs(iso + 'T' + this._pad(this._startHour) + ':00');
    const bandEnd = this._toMs(iso + 'T' + this._pad(this._endHour === 24 ? 23 : this._endHour) + ':' + (this._endHour === 24 ? '59' : '00'));
    const span = bandEnd - bandStart || 1;
    const s = Math.max(this._toMs(ev.start), bandStart);
    const e = Math.min(this._toMs(this._eventEnd(ev)), bandEnd);
    const top = ((s - bandStart) / span) * 100;
    const height = Math.max(((e - s) / span) * 100, 2); // a 2% floor stays clickable
    const laneW = 100 / (p.lanes || 1);
    const left = laneW * (p.lane || 0);
    return {
      top: top.toFixed(2) + '%',
      height: height.toFixed(2) + '%',
      left: left.toFixed(2) + '%',
      width: laneW.toFixed(2) + '%',
    };
  },

  // — internals: labels ————————————————————————————————————————
  _timeLabel(iso) {
    const t = this._timePart(iso);
    return t ? t.slice(1) : ''; // 'HH:mm'
  },

  _timeRange(ev) {
    const s = this._timeLabel(ev.start);
    const e = this._timeLabel(this._eventEnd(ev));
    return e && e !== s ? s + '–' + e : s;
  },

  _hourLabel(h) {
    return this._pad(h) + ':00';
  },

  // An accessible date name for a day cell, e.g. "Saturday, June 20, 2026".
  _dayLabel(iso) {
    const [y, m, d] = this._parts(iso);
    const dow = (new Date(y, m, d).getDay() + 6) % 7;
    return this._dowFull()[dow] + ', ' + this._months()[m] + ' ' + d + ', ' + y;
  },

  _cmpStart(a, b) {
    return this._toMs(a.start) - this._toMs(b.start);
  },

  // — internals: recurrence / range helpers ————————————————————
  _instance(base, start, end, occ) {
    return {
      id: base.id,
      _uid: String(base.id) + '#' + occ,
      title: base.title,
      start,
      end,
      allDay: !!base.allDay,
    };
  },

  // The ISO range the current view shows — drives conflicts() and would drive any
  // host-facing "what's visible" query.
  _visibleRange() {
    if (this.state.view === 'week') {
      const start = this._weekStart(this.state.cursor);
      return { start, end: this._addDays(start, 6) + 'T23:59' };
    }
    const [y, m] = this._parts(this.state.cursor);
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const start = this._iso(new Date(y, m, 1 - lead));
    return { start, end: this._addDays(start, 41) + 'T23:59' };
  },

  // — internals: ICS serialization ——————————————————————————————
  // A DTSTART/DTEND line: a floating local datetime for timed events, a VALUE=DATE
  // for all-day. (Floating local time keeps the export readable and matches how the
  // component stores times; a host needing UTC can post-process.)
  _icsDateLine(name, iso, allDay) {
    if (allDay) return name + ';VALUE=DATE:' + iso.slice(0, 10).replace(/-/g, '');
    return name + ':' + this._icsStamp(iso);
  },

  // 'YYYY-MM-DDTHH:mm' → 'YYYYMMDDTHHMMSS' (local, no trailing Z = floating time).
  _icsStamp(iso) {
    const [datePart, timePart] = iso.split('T');
    const date = datePart.replace(/-/g, '');
    const t = (timePart || '00:00').split(':');
    return date + 'T' + this._pad(+t[0]) + this._pad(+t[1] || 0) + '00';
  },

  // Map a recur object to an RRULE value, or '' when not recurring.
  _rrule(recur) {
    if (!recur || !recur.freq) return '';
    const freq = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' }[recur.freq];
    if (!freq) return '';
    const parts = ['FREQ=' + freq];
    if (recur.interval && recur.interval > 1) parts.push('INTERVAL=' + recur.interval);
    if (recur.count != null) parts.push('COUNT=' + recur.count);
    else if (recur.until != null) parts.push('UNTIL=' + this._icsStamp(this._endOfRange(recur.until)));
    return parts.join(';');
  },

  // Escape an ICS text value (RFC 5545: backslash, comma, semicolon, newline).
  _icsText(s) {
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  },

  _uidFor(ev) {
    const base = ev.id != null ? String(ev.id) : Math.random().toString(36).slice(2);
    return base + '@micra-fullcalendar';
  },

  // — internals: misc ———————————————————————————————————————————
  _pad(n) { return String(n).padStart(2, '0'); },

  _clampHour(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(Math.round(n), 0), 24);
  },

  // Trigger a browser download from an in-memory string (the datatable pattern).
  _download(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },

  // — static label tables ———————————————————————————————————————
  // These are METHODS, not bare data properties: Micra only wires `state`,
  // `onCreate`, `onDestroy`, and functions onto the instance — a plain array
  // property on the define object is silently dropped, so `this._MONTHS` would be
  // undefined. Returning the array from a method keeps them on `this`.
  _months() {
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
  },
  _mon() {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  },
  _dow() {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  },
  _dowFull() {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  },
});
