# Micra components

Ready-made components, templates and library integrations for
[Micra.js](https://micrajs.dev), the small reactive library for server-rendered
HTML. MIT licensed: copy what you need into your project and own the code.

Everything here is plain HTML, JS and CSS. Each folder runs on its own: open its
`index.html` from a static server. Micra itself comes from the CDN and is never
vendored.

## Layout

```
theme/                 Design tokens (--micra-*), light and dark
components/            One folder each: index.html demo, define.js, <name>.css, README
templates/             Finished screens assembled from the components
library-integrations/  Thin Micra wrappers around third-party libraries
prompts/               Context and rules for AI coding assistants
```

## Using a component

Load the tokens, the component's skin, Micra, then its `define.js`, and paste the
markup from the component's README:

```html
<link rel="stylesheet" href="theme/theme.css" />
<link rel="stylesheet" href="components/modal/modal.css" />
<script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
<script src="components/modal/define.js"></script>

<micra-modal>...</micra-modal>
```

`define()` registers the `<micra-modal>` tag, and the tag mounts itself when it
appears in the document, however it got there: server HTML, htmx, Turbo or
`innerHTML`. It also cleans up after itself when removed. The catalog needs Micra
2.14 or later (tags since 2.10, JSON props and `this.listen()` since 2.14); the CDN
`@2` range already serves it. The component READMEs still mention `Micra.start()`: with tags it is optional,
and you need it only when a script reads `Micra.instances()` right after defining.

The attribute form works everywhere too, and it is the one to use when the root has
to stay a specific element, such as `<form>` or `<nav>`:

```html
<div data-component="modal">...</div>
<script>Micra.start();</script>
```

Behavior lives in `define.js` (focus, keyboard, ARIA, data). The look lives in
`<name>.css` and uses only `--micra-*` tokens, so you can re-skin a component by
overriding a few variables or by rewriting its CSS. Dark mode is
`data-theme="dark"`. Tailwind is optional; see [`theme/README.md`](theme/README.md).

Overlays use the platform: the modal, slide-over and command palette are a native
`<dialog>` opened with `showModal()`, the dropdown and popover are native popovers
(`popover` + `popovertarget`), and toasts sit in the top layer above them. Focus
trapping, Escape, outside-click and focus return come from the browser.

Some behavior is still wired by attributes on the component's root, for example
`@pointerdown.outside="close"` on the listbox or `@keydown.meta.k.window.prevent="toggle"`
on the command palette. Keep them when you copy the markup.

## What's here

**Components (27).** Accordion, Breadcrumbs, Charts (SVG), Checkbox, Combobox,
Command Palette, Configurator, Data Table, Date Picker, Dropdown, Form Kit, Full
Calendar, Kanban, Listbox, Mini-cart, Modal, Pagination, Popover, Pricing, Progress,
Radio Group, Slide-over, Slider, Switch, Tabs, Toast, Tooltip.

**Templates (3).** `admin` (users and customers CRUD, settings, command palette),
`dashboard` (overview and settings, charts), `sales` (pipeline with deal details).

**Library integrations (7).** Trix, Chart.js, Swiper, SortableJS, FilePond,
Cropper.js, GLightbox. Each library keeps its own license.

**AI kit.** `prompts/llms-components.txt`, `prompts/rules.md` and
`prompts/task-prompts.md`, for any coding assistant.

## License

[MIT](LICENSE). Support and consulting: hello@micrajs.dev.
