# Micra CRM — sales pipeline template

A drag-and-drop sales pipeline modeled on amoCRM: deal cards carry real data
(budget, contact, company, tags, owner) and a **task traffic-light**, columns sum
their budgets, and a board summary surfaces **deals with no next task**. Click a
card for the full deal — fields, primary contact, activity feed, and won/lost with
a loss reason. One HTML file plus one stylesheet, no build step, token-driven.

Open `index.html` to see it running (light + dark, desktop + mobile).

## What's in it

- **Pipeline board** (the **Kanban** component): six stages — Initial contact,
  Negotiation, Decision making, Contract, Won, Lost. Drag a card, or focus one and
  use the arrow keys, to move it. Each card carries deal name, **budget**,
  **contact · company**, **tags**, the **owner** avatar, and the **task
  traffic-light**: green = task today / upcoming, red = overdue, amber = *no task*.
  Each column header shows its **count and the sum of its budgets**.
- **Board summary** — total pipeline value, won this quarter, and **"N deals
  without a task"**. That last one is amoCRM's core idea: a deal with no next step
  is a problem, so it's surfaced, not hidden.
- **Deal detail** (the **Slide-over** component): budget, stage, owner, task,
  source, tags; the **primary contact** (position, phone, email); an **activity
  feed**; and **Mark won / Mark lost** — closing as lost requires a **loss reason**
  (Too expensive, Chose competitor, …), turning lost deals into data.
- **New deal** enters the pipeline with **no task**, so it immediately counts
  toward the warning — the nudge to schedule a next step.

## Run it

Open `templates/sales/index.html` directly, or serve the repo root with any static
server and visit `/templates/sales/` (keep the trailing slash). Micra and Lucide
load from the CDN; the component behaviors load from `../../components/`.

## How it's built

- `index.html` — the shell (`crm` component: topbar, summary, theme) hosts the
  nested **Kanban** board (seeded from a `data-columns` JSON attribute) and the
  deal **Slide-over** (a `dealdetail` component holding the open deal).
- The Kanban owns drag-and-drop and per-column totals. The shell reads the live
  board to compute the summary and bumps a tick on the board's `move` event so the
  numbers stay current. The card, detail, and shell talk over the **event bus** —
  `deal:open` / `deal:close` / `editor:close` — never reaching into each other's
  state.
- `sales.css` — token-driven layout plus the rich deal-card and detail styling.

**Cards carry arbitrary domain fields.** The Kanban passes every field on a card
straight through to the card template, so `contact`, `company`, `tags`, `source`,
and the `task` object live on the card and render directly — the board isn't
limited to title + value.

## Wire it to your data

- **The board** seeds from `data-columns` JSON. Swap it for your pipeline, or drive
  it from JS: `board.setColumns([...])`. Persist moves by handling the board's
  `move` event (`{ cardId, from, to, index }`) — POST it to your server.
- **The deal detail** derives the contact fields and the activity feed from the
  deal for the demo; point `contactPhone()` / `contactEmail()` / `feed()` at your
  contact and timeline endpoints.
- **Loss reasons, sources, and tags** are plain enums — match them to your CRM.

## Theming

- **Recolor / reshape** by overriding tokens — the task lights, tag tones, and
  stage badge all derive from `--micra-*`:

  ```css
  :root { --micra-primary: #0ea5e9; --micra-success: #16a34a; }
  ```

- **Dark mode** — the topbar toggle sets `data-theme` on `<html>`; the OS
  preference applies by default unless `data-theme="light"` is set.
- **Full control** — `sales.css` is plain CSS. It's yours; edit it.

## Accessibility

Cards are keyboard-movable (focus a card, arrow keys move it) with a polite live
region announcing each move. The Slide-over is
`role="dialog"` + `aria-modal` with a focus trap, focus return, Escape, and body
scroll lock. Motion respects `prefers-reduced-motion`.

## License

MIT — see `LICENSE` in the repo root.
