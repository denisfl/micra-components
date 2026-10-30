# Date picker

Accessible single-date picker: a readonly combobox input shows the chosen date and
opens a dialog popover holding a month calendar grid. Arrow keys move day to day,
Home/End jump to the week's ends, PageUp/PageDown step a month, Enter or Space
selects, the header arrows browse months, Escape closes, click or outside-click
dismisses. It is the WAI-ARIA date-picker dialog pattern (react-aria DatePicker /
Headless UI style). Headless behavior in `define.js`; the look is a default skin in
`datepicker.css` driven by `theme/theme.css` tokens.

Open `index.html` to see it running (light + dark).

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="datepicker.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup. Give the popover an id and point `aria-controls` at it;
   label the grid with the month label's id. To preselect, add an ISO
   `data-value="<YYYY-MM-DD>"` — the view opens on that month with that day
   selected. The outer `data-each` item is the **week**, the nested one is the
   **day**:

   ```html
   <micra-datepicker @pointerdown.outside="close" data-value="2026-06-19">
     <div class="micra-datepicker">
       <input
         class="micra-datepicker__input"
         role="combobox"
         aria-haspopup="dialog"
         aria-controls="dp-popover"
         placeholder="Pick a date"
         readonly
         data-ref="input"
         data-bind="value:displayValue(), aria-expanded:open ? 'true' : 'false'"
         @click="toggle"
         @keydown.down.prevent="open"
         @keydown.escape="close"
       />

       <div
         class="micra-datepicker__popover"
         id="dp-popover"
         role="dialog"
         aria-label="Choose date"
         data-ref="popover"
         tabindex="-1"
         data-bind="data-state:open ? 'open' : 'closed'"
       >
         <div class="micra-datepicker__header">
           <button class="micra-datepicker__nav" type="button"
                   aria-label="Previous month" @click="prevMonth">‹</button>
           <div class="micra-datepicker__label" id="dp-label"
                aria-live="polite" data-text="monthLabel()"></div>
           <button class="micra-datepicker__nav" type="button"
                   aria-label="Next month" @click="nextMonth">›</button>
         </div>

         <div class="micra-datepicker__weekdays" aria-hidden="true">
           <span class="micra-datepicker__weekday">Mon</span>
           <span class="micra-datepicker__weekday">Tue</span>
           <span class="micra-datepicker__weekday">Wed</span>
           <span class="micra-datepicker__weekday">Thu</span>
           <span class="micra-datepicker__weekday">Fri</span>
           <span class="micra-datepicker__weekday">Sat</span>
           <span class="micra-datepicker__weekday">Sun</span>
         </div>

         <div
           class="micra-datepicker__grid"
           role="grid"
           aria-labelledby="dp-label"
           @keydown.left.prevent="moveLeft"
           @keydown.right.prevent="moveRight"
           @keydown.up.prevent="moveUp"
           @keydown.down.prevent="moveDown"
           @keydown.home.prevent="moveWeekStart"
           @keydown.end.prevent="moveWeekEnd"
           @keydown.pageup.prevent="movePrevMonth"
           @keydown.pagedown.prevent="moveNextMonth"
           @keydown.enter.prevent="chooseFocused"
           @keydown.space.prevent="chooseFocused"
           @keydown.escape="close"
         >
           <template data-each="weeks()" data-key="key">
             <div class="micra-datepicker__row" role="row">
               <template data-each="item.days" data-key="iso">
                 <button
                   class="micra-datepicker__day"
                   type="button"
                   role="gridcell"
                   data-text="item.day"
                   data-bind="tabindex:item.iso === focusedISO ? 0 : -1, aria-selected:isSelected(item.iso) ? 'true' : 'false', aria-current:item.today ? 'date' : 'false', data-state:cellState(item)"
                   @click="selectDay(item.iso)"
                 ></button>
               </template>
             </div>
           </template>
         </div>
       </div>
     </div>
   </micra-datepicker>
   ```

   The `.micra-datepicker` element is the positioning context — it must wrap
   **only** the input and the popover, so the popover anchors under the input.
   Sibling content lives outside it.

   Dates are stored and emitted as ISO `YYYY-MM-DD` strings. Weeks start on Monday;
   the grid renders six full rows, padding with the adjacent months' days (rendered
   muted but still selectable — picking one navigates to its month). Listen for the
   `change` event (`this.on('change', d)`) where `d` is
   `{ iso, year, month, day }` (`month` is 1–12).

3. Call `Micra.start()` once, after your components are defined.

Multiple date pickers on one page work out of the box — each
`<micra-datepicker>` is an independent instance with its own state. Give
each one a distinct `aria-controls` / popover `id` and grid label `id`.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 4px; }
  ```

- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `datepicker.css`. It is yours.
- **Tailwind (optional)** — open/closed lives in `data-state` on the popover, and
  each day's selected / today / out-of-month state in `data-state`, so you can skip
  `datepicker.css` and style with native variants:
  `class="… data-[state=open]:opacity-100 data-[state=selected]:bg-indigo-600"`.

## Accessibility

The input is `role="combobox"` with `aria-haspopup="dialog"`, `aria-expanded` bound
to the open state, and `aria-controls` pointing at the popover; it stays `readonly`
so selection happens in the grid, not by typing. The popover is `role="dialog"`
with an `aria-label`. The calendar is a `role="grid"` labelled by the month label,
with `role="row"` weeks and `role="gridcell"` days; the selected day carries
`aria-selected="true"` and today carries `aria-current="date"`. Roving tabindex
means only the focused day is tabbable. Full keyboard grid navigation crosses month
boundaries: arrows move by day/week, Home/End to the week's ends, PageUp/PageDown by
month — and when focus leaves the shown month the view follows it. Focus moves into
the grid on open (after the popover is actually visible) and returns to the input on
close or Escape. Weekday headers and the navigation glyphs are `aria-hidden`. Motion
respects `prefers-reduced-motion` (tokens zero the duration); the popover is
non-interactive and never flashes when closed (`visibility: hidden`).

## License

MIT — see `LICENSE` in the repo root.
