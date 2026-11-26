# Working on ChatScreenshot

## What this is

A DeepSeek Harness client plugin that renders a conversation to a PNG and writes it to the clipboard.
It owns no host service and stores nothing: the page's own DOM is the input, and the clipboard or a
download is the output.

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
- Parts stay importable by node on their own: `export` on every top-level declaration (the build
  strips it when joining) and an `import` for everything used from a neighbour, even though the
  joined scope would hide the omission.
- Sources are written without trailing semicolons in JavaScript. The CSS inside
  `shell/style.js` is a template string and keeps its own semicolons; a mechanical pass over
  semicolons must skip that file.
- The plugin declares no host `Config` and no persisted settings. A capture must never need a
  restart.

## Verification

```bash
node build.mjs --check
node checks/structure.mjs
node checks/i18n.mjs
node checks/logic.mjs
```

The checks cover the bundle contract, the language tables and the pure helpers. None of them can tell
whether the picture looks right: for that, load the page, click both cameras, and paste the result.

`apply` publishes `window.__chatScreenshot`, removed when the plugin unloads. It carries
`captureConversation(anchor)`, `captureTurn(tail)` and `translate(key, vars)`. The handle exists so a
capture path can be tried in a sandbox page without a rendered action row: `captureTurn` takes a
`[data-turn-tail]` element, `captureConversation` takes anything inside the conversation scroller, and
both resolve to a shot object with the blob, pixel size, scale and renderer mode.

A rebuilt bundle is served under a content revision fixed at composition, so a running host keeps the
old bytes: toggle the plugin off and on, then reload.

中文版见 [AGENTS.zh-CN.md](AGENTS.zh-CN.md)。
