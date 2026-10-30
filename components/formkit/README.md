# Form Kit

Schema-driven forms with the parts that are tedious to get right: per-field
validation, multi-step navigation with a stepper, file upload with a thumbnail
preview and progress, and debounced autosave to `localStorage`. Headless behavior
in `define.js`; the look is a default skin in `formkit.css` driven by
`theme/theme.css` tokens.

Open `index.html` to see it running (light + dark): a three-step Account →
Profile → Review form that blocks Next on invalid input, previews an avatar
upload, and shows a "Saved" indicator as you type.

## Use it

1. Load the tokens, the skin, Micra, and the behavior:

   ```html
   <link rel="stylesheet" href="theme/theme.css" />
   <link rel="stylesheet" href="formkit.css" />
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2/dist/micra.min.js"></script>
   <script src="define.js"></script>
   ```

2. Drop in the markup and seed a schema. The schema can come from a `data-schema`
   JSON attribute (set it before `Micra.start()`), or you can assign
   `instance.state.schema` from JS after mount. Set `data-autosave-key` to enable
   autosave; omit it to turn autosave off.

   ```html
   <form class="micra-formkit"
         data-component="formkit"
         data-autosave-key="signup-draft"
         novalidate
         @submit.prevent="submit">
     <!-- stepper, fields, footer — see index.html for the full template -->
   </form>

   <script>
     const schema = {
       steps: [
         { title: 'Account', fields: [
           { name: 'name',  label: 'Full name', type: 'text',  required: true },
           { name: 'email', label: 'Email',     type: 'email', required: true },
           { name: 'password', label: 'Password', type: 'password',
             required: true, minLength: 8, rule: 'strongPassword' },
         ]},
         { title: 'Review', fields: [
           { name: 'terms', label: 'I accept the terms', type: 'checkbox', required: true },
         ]},
       ],
     };
     const form = document.querySelector('[data-component="formkit"]');
     form.setAttribute('data-schema', JSON.stringify(schema));

     Micra.start();

     const fk = Micra.instances().get(form);
     fk.on('submit',   (values) => console.log('submit', values));
     fk.on('autosave', (values) => console.log('autosave', values));
   </script>
   ```

3. Call `Micra.start()` once, after the component is defined and the schema
   attribute is set.

Multiple forms on one page work out of the box — each `data-component="formkit"`
is an independent instance with its own state and its own autosave key.

## Schema

A schema is `{ steps: [ { title, fields: [ field… ] } ] }`. Each field:

| Key | Type | Notes |
|-----|------|-------|
| `name` | string | Unique key; also the `values` key. |
| `label` | string | Shown in the label and in error messages. |
| `type` | string | `text` `email` `number` `password` `textarea` `select` `checkbox` `radio` `file`. |
| `required` | bool | Empty (`''`, `false`, no file) fails. |
| `placeholder` | string | Input placeholder / select prompt. |
| `pattern` | string | A regex source; compiled with `new RegExp`. |
| `min` / `max` | number | Range for `type: number`. |
| `minLength` / `maxLength` | number | String length bounds. |
| `options` | array | `[{ value, label }]` for `select` / `radio`. |
| `help` | string | Hint text, wired via `aria-describedby`. |
| `rule` | string | A named built-in validator (see below). |
| `default` | any | Initial value (defaults: `''`, or `false` for checkbox). |

Custom JavaScript validators can't travel inside JSON, so a field references a
**named rule** by string. The built-ins are `strongPassword` (requires letters
and digits) and `url`. Add your own by extending the `_rules()` map in
`define.js` — each rule is `(value, allValues) => '' | 'error message'`.

## State and events

State is raw data only; everything derived is a method.

- `state.values` — `{ name: value }`. Written through `this.set('values.' + name, v)`
  so the shallow proxy stays intact (no in-place nested mutation).
- `state.errors` — `{ name: message }`, only invalid fields present. Rebuilt and
  replaced on each validation pass.
- `state.touched` — fields the user has blurred (or that a blocked Next/Submit
  marked). Errors render only once a field is touched.
- `state.step`, `state.uploads`, `state.savedAt`, `state.submitting`.

Events on the instance bus:

- `submit` — emitted with a plain copy of the values when the whole form is
  valid. The host owns persistence.
- `autosave` — emitted (debounced) with the values whenever they change, after
  writing them to `localStorage[autosaveKey]`.

## Validation, steps, files, autosave

- **Validation** runs on blur (the field is marked touched), before advancing a
  step, and on submit. Rules apply in order: required, then email format,
  length, pattern, numeric range, then any named rule. `hasError(name)`,
  `errorFor(name)`, `stepValid(i)`, and `formValid()` are methods.
- **Steps** — `next()` validates the current step and refuses to advance while it
  is invalid (marking its fields touched so the messages appear); `prev()` steps
  back. The stepper exposes `data-state="done|current|upcoming"` per step and
  `aria-current="step"` on the active one. A blocked `submit()` jumps to the
  first step with an error and focuses its first invalid field.
- **File upload** — `onFile` reads the chosen file, builds a preview (an object
  URL thumbnail for images, a filename + size caption otherwise), and runs a
  **simulated** upload that ticks `uploads[name].progress` from 0 to 100. To wire
  a real backend, replace the `setInterval` in `onFile` with an `XMLHttpRequest`
  and update progress from `xhr.upload.onprogress`
  (`progress = e.loaded / e.total * 100`); keep the `removeFile` cleanup
  (revoking the object URL) as-is. The progress bar width comes from
  `progressStyle` / `uploadStyle`, which return a real style object — inline
  `{…}` literals do not work in a binding expression.
- **Autosave** — any value change schedules a save ~800 ms later (override with
  `data-autosave-debounce`). The save writes `state.values` to
  `localStorage[autosaveKey]`, stamps `state.savedAt`, and emits `autosave`. On
  mount, a saved draft is restored over the field defaults. The single debounce
  timer and every upload interval are cleared in `onDestroy`.

## Theming

- **Recolor / reshape** without touching this component — override tokens:

  ```css
  :root { --micra-primary: #16a34a; --micra-radius: 6px; }
  ```

  Inputs, the stepper, the progress bars, and the focus ring all follow. Invalid
  fields and error text use `--micra-error`; the "Saved" indicator uses
  `--micra-success`.
- **Dark mode** — set `data-theme="dark"` on `<html>` (or rely on the OS
  preference; `theme.css` auto-applies dark unless `data-theme="light"`).
- **Full control** — edit `formkit.css`. It is yours.
- **Tailwind (optional)** — the stepper and upload bar expose their state in
  `data-state`, so you can skip `formkit.css` and style with native variants
  (`data-[state=current]:`, `data-[state=done]:`).

## Accessibility

Each step is a `<fieldset>` with a `<legend>`; every control is tied to its
`<label for>`. Inputs carry `aria-required` and `aria-invalid` (as the strings
`"true"`/`"false"`) and an `aria-describedby` that points at the field's help and
error text, so the message is announced. The stepper marks the active step with
`aria-current="step"` and a polite live region announces the autosave note.
Motion respects `prefers-reduced-motion` (tokens zero the duration).

## License

MIT — see `LICENSE` in the repo root.
