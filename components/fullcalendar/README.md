# Full Calendar

A month / week scheduler: a six-row month grid and a week time-grid, prev / next /
today navigation, basic recurring events (daily / weekly / monthly), overlap
(conflict) detection, and an `.ics` export. Events are stored and emitted as ISO
strings; every layout — the month grid, the week columns, event placement, the
titles, the conflict set — is derived on read, never held in state. Headless
behavior in `define.js`; the look is a default skin in `fullcalendar.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark), with month and week views, a
seeded set of events (including a same-day time conflict, an all-day event, and a
weekly- and a monthly-recurring series), and `create` / `select` events logged to
the console.

**v1 scope.** Month and week views, navigation, events, basic recurrence, conflict
detection, and `.ics` export. **Day view and drag-to-reschedule are deferred** — the
state shape and the date-math methods are built to accommodate them later, but they
are not in this version.

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="fullcalendar.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup (the full month + week markup is in `index.html` — copy it).

> The demo's event editor composes with the **Slide-over** component
> (`components/slideover/`) — the packaged zip includes it. The calendar itself
> has no hard dependency on it; wire `event:open` to any editor you like.
   The root takes an optional `data-view` (`"month"` | `"week"`, default `month`)
   and an optional `data-events` JSON array; richer data (functions, large sets) is
   easier to feed from JS after `Micra.start()`:

   ```js
   Micra.start();

   const root = document.querySelector('[data-component="fullcalendar"]');
   const cal = Micra.instances().get(root); // live instance, keyed by root el

   cal.setEvents([
     { id: 'standup', title: 'Standup', start: '2026-06-20T09:00', end: '2026-06-20T09:30' },
     { id: 'review',  title: 'Design review', start: '2026-06-20T09:15', end: '2026-06-20T10:15' }, // overlaps → conflict
     { id: 'offsite', title: 'Team offsite', start: '2026-06-22', allDay: true },
     { id: 'sync',    title: 'Weekly sync', start: '2026-06-15T15:00', end: '2026-06-15T16:00',
       recur: { freq: 'weekly', count: 4 } },
   ]);

   cal.on('create', ({ date, start }) => { /* open your create dialog */ });
   cal.on('select', (event) => { /* open / edit the clicked event */ });
   ```

3. Call `Micra.start()` once, after your components are defined.

### Events

`{ id, title, start, end?, allDay?, recur? }`.

- `start` / `end` are ISO datetimes `'YYYY-MM-DDTHH:mm'` (floating local time), or a
  bare date `'YYYY-MM-DD'` when `allDay: true`. A missing `end` defaults to a
  one-hour block (timed) or the same day (all-day).
- `recur` (optional) is `{ freq, interval?, count?, until? }` where `freq` is
  `'daily'`, `'weekly'`, or `'monthly'`, `interval` is the step (default `1`),
  `count` caps the number of occurrences, and `until` (an ISO date/datetime) caps
  the range. Recurrence is expanded only across the visible range and is capped
  (`data-recur-cap`, default 366 steps) so a malformed rule can't loop forever.

### Configuration (root `data-*`)

- `data-view` — initial view (`"month"` | `"week"`).
- `data-events` — a JSON array of events (alternative to `setEvents`).
- `data-start-hour` / `data-end-hour` — the week view's visible time band (default
  `6`–`22`, i.e. hours 6:00–21:00 shown). Set `data-start-hour="0" data-end-hour="24"`
  for a full day, `9`/`18` for business hours, etc. If they cross or invert, the band
  falls back to the full `0`–`24`. Changeable at runtime via `setHourRange()`.
- `data-chip-limit` — how many event chips a month cell shows before collapsing to
  "+K more" (default `3`).
- `data-recur-cap` — maximum recurrence steps per series (default `366`).

### Public API and events

- `setEvents(events)` — replace the whole event set.
- `setView('month' | 'week')` — switch view, keeping the cursor.
- `goTo(iso)` — move the cursor to an ISO day (the week / month containing it shows).
- `setHourRange(start, end)` — change the week view's visible time band at runtime.
- `prev()` / `next()` / `today()` — navigate by month (month view) or week (week view).
- `conflicts()` — `{ pairs: [{ a, b }], count, ids }` for the current visible range
  (`a` / `b` are base event ids).
- `buildICS()` — the `.ics` string (also testable directly); `exportICS()` builds it
  and triggers a download.
- `eventStyle(event)` — the placement object `{ top, height, left, width }` for a
  timed event (exposed so the geometry is unit-testable).

Emitted events:

- `create` `{ date, start? }` — a click on an empty month day (`date` only) or an
  empty week slot (`date` + `start` at that hour). The host opens its own create UI.
- `select` `{ ...event }` — a click on an event chip / block; the base event record
  is resolved from its id (recurrence instances share their base id).

### How the views are built

- **Month.** A 6×7 Monday-start grid is built from native `Date` (the datepicker
  approach), padded with adjacent-month days. Recurrence is expanded once across the
  42-day grid, bucketed by day, and each cell is **pre-flattened** with its event
  chips and `today` / `outside` flags — so the nested `data-each` over a day's chips
  is self-contained and never reaches the outer cell scope.
- **Week.** The seven days around the cursor become columns; the hours become a
  background grid. Each timed event is absolutely positioned by `eventStyle()` —
  vertical from its start/end as a percentage of the visible band, horizontal from
  its overlap lane. The style is a **real object** returned from a method and bound
  with `data-bind="style:item.style"` (an inline `{…}` style literal in a binding
  does not work). All-day events sit in a band above the grid.

### Conflict detection

Two timed events conflict when they fall on the **same day** and their `[start, end)`
intervals overlap. In month view a conflicting chip is tinted with the warning
accent; in week view overlapping events are laid **side by side** (the day column
splits into lanes) and also marked `data-state="conflict"`. `conflicts()` returns the
overlapping pairs over the current visible range, so a host can surface a warning.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

  Event chips and timed blocks use `--micra-primary`; today's pill and the focus
  ring follow `--micra-primary` / `--micra-ring`; conflicts use `--micra-warning`;
  out-of-month days and hover tints are a `color-mix` of the accent / border, so they
  track the theme with no hardcoded hue.

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS preference;
  `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `fullcalendar.css`. It is yours. The today pill, the
  hour-line grid, and the chip shapes are all CSS drawn from tokens, not images.
- **Tailwind (optional)** — view state lives in `aria-pressed` on the toggle, the
  day state in `data-state`, today in `aria-current`, and conflicts in `data-state`,
  so you can skip `fullcalendar.css` and style with native variants:
  `class="… aria-[pressed=true]:bg-indigo-600 data-[state=conflict]:bg-amber-500"`.

## Accessibility

The month view is a `role="grid"` of `role="row"` weeks and `role="gridcell"` days;
each day cell is a `<button>` with an accessible date name (e.g. "Saturday, June 20,
2026") and today carries `aria-current="date"`. Event chips are keyboard-activatable
`role="button"` elements whose accessible name is the title plus its time (or "all
day"). The week view labels each day column, the hour rail is presentational, and
each timed event is a `<button>` named by title + time range; empty-slot buttons are
labelled "Create at HH:00". The Month / Week toggle is a labelled `role="group"`
whose buttons carry `aria-pressed` as the string `"true"` / `"false"`. The navigation
buttons are labelled, and the live title announces via `aria-live="polite"`. Focus
rings are visible via `--micra-ring`; motion respects `prefers-reduced-motion`
(tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
