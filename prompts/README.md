# Micra components — AI kit

Files that make your AI coding assistant write correct Micra code with these components
instead of defaulting to React patterns. No magic — just the right context and rules
in the right place.

## What's here

- **`llms-components.txt`** — the components reference: the token contract, using and
  composing components, the integration wrapper pattern, and the gotchas LLMs get
  wrong. It's an addendum to the core `llms-full.txt` (linked inside).
- **`rules.md`** — short do/don't rules to install as your assistant's rules file.
- **`task-prompts.md`** — copy-paste prompts for common tasks (generate a component,
  re-skin via tokens, wrap a library, convert imperative DOM code, wire to a server).

## Use it with your assistant

Two things help any assistant: (1) the **rules** as a persistent instruction, and
(2) the **reference** as on-demand context.

- **Cursor** — save `rules.md` as `.cursorrules` (or a `.mdc` in `.cursor/rules/`).
  Drop `llms-components.txt` in the repo and `@`-mention it, or add it to Docs.
- **Claude Code** — append `rules.md` to your project `CLAUDE.md`; keep
  `llms-components.txt` in the repo so it can be read on demand.
- **GitHub Copilot** — put `rules.md` at `.github/copilot-instructions.md`.
- **Windsurf** — add `rules.md` as a workspace rule; index `llms-components.txt`.
- **ChatGPT / Claude chat** — paste `rules.md` + `llms-components.txt` into the system
  prompt or a Project, then use a prompt from `task-prompts.md`.

For full coverage, also give it the core
[`llms-full.txt`](https://github.com/denisfl/micra.js/blob/master/llms-full.txt) —
it carries the core directives, the 12 recipes, and the anti-pattern reference that
`llms-components.txt` builds on.

## Why this works

LLMs reliably trip on a few Micra specifics — ARIA bound as a bare boolean,
`data-text` on an uncalled method, `data-model` on a checkbox, charts seeded after
`start()`, reaching into a nested component's state instead of using the event bus.
These files name those traps directly, so the assistant avoids them up front instead
of after a review.

## License

MIT — see `LICENSE` in the repo root.
