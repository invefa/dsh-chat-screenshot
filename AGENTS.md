# Working on ChatScreenshot

## What this is

A DeepSeek Harness client plugin that renders a conversation to a PNG and writes it to the clipboard.
It owns no host service and stores nothing on the server: the page's own DOM is the input, the
clipboard or a download is the output, and the only persisted state is one `localStorage` key.

| Piece | Path |
| --- | --- |
| Host entry (empty on purpose) | `index.js` |
| Browser entry, registration | `src/client/apply.js` |
| Numbers and host markers | `src/client/shell/const.js` |
| Message tables, locale wiring | `src/client/shell/i18n.js` |
| Status state and one delivery path | `src/client/shell/status.js` |
| Clone preparation and the capture | `src/client/dom/` |
| Renderers, crop, canvas budget | `src/client/render/` |
| Clipboard and download | `src/client/output/` |
| Button body, entries, icons | `src/client/views/` |
| Bundle order | `src/client/manifest.json` |
| Checks | `checks/` |

`client.js` is generated. Edit `src/client/`, then `node build.mjs`.

## Language

Code, identifiers, comments, commit messages and log lines are English. User-facing copy lives in
`src/client/shell/i18n.js` and `locale/`; both languages hold the same keys, and a check enforces it.
Documentation is English with a `.zh-CN.md` edition.

## Design rules

- One thing, one place: `dom/` reads and stages the page, `render/` turns the stage into pixels,
  `output/` delivers the bytes, `views/` draws the controls, `shell/i18n.js` is the only
  user-facing prose. A new number belongs in `const.js`, not at a call site.
- The SVG renderer is the main path, the hand painter is the fallback. Do not "simplify" the fallback
  away: the SVG document cannot always be decoded, and the hand painter is what still produces a
  readable picture then. Both read the same staged clone.
- Everything happens on the clone. The live composer, the scroll position and the host's state must
  never be written by a capture; that is why the stage exists at all.
- Crop by geometry, prune by marker. The stat strip has no stable wrapper, so it is cut by the
  topmost `[data-composer-stat]` pill; the chrome subtrees are pruned by their own attributes.
- The style sheet is harvested from its source, not from the parsed rules. `cssRules[i].cssText`
  serializes what the engine understood, and a shorthand written as a `var()` collapses there into
  empty longhands: the app sets its markdown type scale with `font: var(--dsw-font-markdown-code)`
  (size, line height and family in one declaration), so a sheet rebuilt from parsed rules draws
  inline code with the inherited line height and the pill comes out several pixels too tall. Read
  `<style>` text, fetch `<link>` files, and keep `serializeSheet` only as the fallback for a sheet
  whose element cannot be read.
- A marker can be reused by both sides of an exchange. Every turn's metadata row carries
  `data-clock`, the user's message `start` and the answer `end`, so chrome is matched on the
  attribute, not on one of its values.
- A capture reports what it actually did. When the history cannot be drained, the toast says the
  picture covers the loaded turns only; a renderer fallback is logged, never hidden.
- The paging control never unmounts. It stays in the layout, turns `disabled` and swaps its visible
  label for "start of conversation", and it carries all five labels at once with the inactive ones
  `aria-hidden`. Read the visible label, treat `disabled` or `start` as "the history is complete", and
  never click a control that is busy or disabled: the button-as-it-exists reading is what kept a
  capture waiting out the whole history budget on a transcript that was already complete.
- Anything the settings add to the picture is built inside the staged clone, above the first turn or
  below the last one. The SVG path serializes that element alone, so a header mounted beside it would
  be laid out and then left out of the bytes. Colours there are literal greys: a `var(--dsw-alias-*)`
  resolves in the live page, which is what the hand painter reads, but the serialized document has no
  theme root, and the two paths would then disagree.
- Preferences live in `localStorage` under one key, `chat-screenshot.options`, and every read
  normalises them: a hand-edited key, a value from an older build and an unoffered margin all land on
  an offered value before a capture sees them. The plugin declares no host `Config`, and a capture
  must never need a restart. The settings section is a single `settings.section` registration: the
  host draws the navigation label and hands the component `close` alone, so the section renders rows,
  not a heading.
- The settings shape the picture where it is drawn. "Adjust the shot" opens an editor over the
  conversation: the same staged clone a capture renders, mounted at full length in a scrolling frame,
  with every piece still in place. A switch is a click on the piece itself, and a switched-off piece
  dims and stays where the picture would draw it — no setting is invisible, and no part is
  special-cased into permanent absence. Anything the editor shows comes from `readOptions()`; a
  control that kept its own state would show a picture no capture will ever make.
- `dom/rules.js` is the only path that hides anything, and `shell/options.js` is the only
  shape it reads. A part the plugin names is a rule like any other: the built-in eight keep their names
  and defaults in `CHROME_PIECES`, but they travel through `applyRules` exactly as a user rule does,
  so the capture and the editor cannot disagree about what is hidden. Nothing is removed
  unconditionally at a call site — the load-earlier control and the composer used to be cut that way,
  which is exactly how they became settings nobody could find.
- Hiding is a declaration, not a deletion. A hidden element keeps its place in the copy and loses its
  space in the picture: that is what lets the editor point at the hole, flash it back and restore it,
  and what keeps the measured picture honest.
- Any element is a candidate. A rule carries a selector, not an identity, so whatever a plugin adds to
  the transcript is reachable with the same two clicks; `elementKey` mints a selector for the element
  under the pointer, and the side panel is where it gets a name and a style.
- The editor's root is mounted on `document.body`. The overlay is `position: fixed`, and inside a
  subtree that carries a `transform` or a `filter` it would be positioned against that ancestor
  instead of the viewport. It is placed over the conversation's own rectangle rather than over the
  window: a frameless window draws its title bar and its window buttons above the page, so a surface
  that started at the top of the viewport would put its bar under the buttons and let the title bar
  show through it.
- The editor rebuilds the clone on a revision counter, not on the options object. Typed text goes
  straight into the stored options, and rebuilding on every keystroke would take the caret out of the
  field being written in. Clicks inside the copy are cancelled: the clone carries no React listeners,
  so a link or a button there would otherwise navigate the live page.
- The right-click menu and the turn chooser are the host's own components. `shell/runtime.js` exposes
  them as `native`, read from the `@deepseek-ai/dsh-client-ui-primitives` seed word that the module
  system hands every package; a hand-rolled menu would lose the theme, the focus trap and the keyboard
  handling the surrounding UI already has. `native` may be undefined in a build that ships no seed, so
  every use falls back to render nothing rather than to throw.
- The tools live in a tray along the bottom of the editor, not in a side column. A side column takes
  width away from the copy, and the copy is the thing being judged; the tray carries the hidden list,
  the inspector and the library, and the preview keeps the full width of the conversation.
- The added content is a list of blocks, not a fixed header and footer. A block is
  `{ id, kind, zone, ... }` with `kind` in text / spacer / image / divider / meta and `zone` in top /
  bottom, so the two fixed fields that used to be here are two ordinary blocks; the library appends or
  drags one in, and a block already in the picture is dragged to move it, both zones included.
- Text in a block is a template. `dom/tokens.js` reads the conversation and the host for
  `{turns}` `{prompts}` `{date}` `{time}` `{weekday}` `{title}` `{model}` `{session}` `{app}`
  `{version}`, and only those are replaced, at capture time; unknown braces survive, and the editor
  shows the placeholders because it renders with the raw values.
- An image block holds a data URL and nothing else. A picked file is read in the page, so the picture
  never needs a network round trip and nothing is uploaded; anything past the size cap is refused at
  normalize time rather than stored and silently dropped later.
- A saved component is a block with a name. Saving a block copies it into `custom`, and the library
  appends a fresh copy with a new id; components are not a second rendering path, so a change to how a
  block is drawn reaches the presets and the saved components at once.
- A view function is called through `h(component, props)`, never as `component(props)`. React keeps
  hooks in call order, so calling a component as a plain function puts its `useState` into the parent's
  list and the tree comes down when the order changes; the surface is wrapped in an error boundary for
  the same reason — one bad render should print what broke over the conversation instead of leaving a
  blank screen.
- The editor shows the band a capture would keep, not the page: the copy is measured after it is
  mounted (`stage.frame()`), because a detached subtree has no boxes and would collapse the frame, and
  it is rebuilt when the window resizes or zooms, because the width of the copy is the conversation's
  width at the moment it was built. A menu opened from the composer closes on the conversation's own
  scroll, so it cannot drift away from the button that opened it.
- A turn is keyed by its opening message, not by the reply. Turns are read from
  `[data-chat-flow-kind="user"]`, a turn ends where the next one opens, and a reply that is still
  streaming has no `[data-turn-tail]` yet — it is still a turn, and it is capturable. Selecting several
  turns keeps those bands and drops the rest, so the picture holds no gap where the skipped turns were.
- Parts stay importable by node on their own: `export` on every top-level declaration (the build
  strips it when joining) and an `import` for everything used from a neighbour, even though the
  joined scope would hide the omission.
- Sources are written without trailing semicolons in JavaScript. The CSS inside
  `shell/style.js` is a template string and keeps its own semicolons; a mechanical pass over
  semicolons must skip that file.

## Verification

```bash
node build.mjs --check
node checks/structure.mjs
node checks/i18n.mjs
node checks/logic.mjs
node checks/serve.mjs   # then open http://127.0.0.1:8712/checks/dom.html
```

The first four cover the bundle contract, the language tables and the pure helpers. `checks/dom.html`
runs the parts that need a document — the paging labels, the piece table, the editor's copy and the
fields it opens, the inserted blocks and the crop they feed — against a fixture built from the host's
markers, and prints PASS/FAIL in the tab title with the per-case detail on `window.__verify`.
`checks/serve.mjs` exists because a browser refuses a module graph loaded from `file://`.

None of them can tell whether the picture looks right: for that, load the page, click both cameras, and
paste the result.

`apply` publishes `window.__chatScreenshot`, removed when the plugin unloads. It carries
`captureConversation(anchor)`, `captureTurn(tail)`, `openEditor()` and `translate(key, vars)`. The handle exists so a
capture path can be tried in a sandbox page without a rendered action row: `captureTurn` takes a
`[data-turn-tail]` element, `captureConversation` takes anything inside the conversation scroller, and
both resolve to a shot object with the blob, pixel size, scale and renderer mode.

A rebuilt bundle is served under a content revision fixed at composition, so a running host keeps the
old bytes: toggle the plugin off and on, then reload.

中文版见 [AGENTS.zh-CN.md](AGENTS.zh-CN.md)。




