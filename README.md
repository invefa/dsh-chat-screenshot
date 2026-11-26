# dsh-chat-screenshot

A DeepSeek Harness plugin that turns a conversation into a single PNG, shaped the way you want it, and puts the picture on the clipboard.

English | [中文](README.zh-CN.md)

The camera lives in the composer toolbar. One click copies the whole conversation; its right-click menu narrows the shot to the last exchange or to any set of turns you tick. Every reply also carries its own camera, so one question and one answer is one picture. When the browser refuses the clipboard write, the file is downloaded instead.

Nothing about the picture is fixed. Open the editor and the conversation itself becomes the canvas: every element that would land in the picture is there, and you decide what stays, what goes, what gets added above and below, and how it is drawn. The editor is the capture — the same build path produces both — so what you see while shaping the shot is exactly what lands in the PNG.

## Install

```bash
dsh plugin --profile web add D:\Projects\Agent\DSH\Plugin\ChatScreenshot
```

Remove it again:

```bash
dsh plugin --profile web remove dsh-chat-screenshot
```

The plugin id is `dsh-chat-screenshot`. Reload the page after installing.

## Taking a picture

| Entry | Where | What it captures |
| --- | --- | --- |
| Whole conversation | Camera in the composer toolbar | Everything in the open conversation, after draining older history |
| One turn | Camera in a reply's action row | From the user message that opens that turn up to the next one |
| Chosen turns | Right-click the composer camera, then **Choose turns...** | The ticked exchanges, stacked in reading order |
| Last turn | Right-click the composer camera, then **Last turn** | The exchange that is open now, including a reply that is still streaming |

Both buttons are icon-only, spin while working, flash a check on success, and report the result above the row. The right-click menu and the turn chooser are the application's own components, so they follow its theme and keyboard handling.

Older history is drained through the chat view's own "load earlier" control first. That control never disappears: when the history ends it stays in place, disabled and relabelled "start of conversation", so the capture reads its visible label and stops. If the host cannot deliver another page, the capture still happens and the toast says the picture covers the loaded turns only.

## The editor

Settings > ChatScreenshot opens the editor over the conversation. Every tool lives in a dock along the bottom, so the picture above it is never narrowed, and the dock resizes by dragging its handle or folding by double-clicking it.

- **Any element is a candidate.** Double-click anything in the copy to hide it, double-click again to bring it back. The controls this plugin knows by name are only a starting vocabulary; whatever a plugin or a future version adds to the transcript is reachable the same way.
- **Hiding is a declaration.** A hidden element keeps its place in the copy and takes no room in the picture, so the picture measures as if it were never there, and the editor can still point at the gap.
- **The elements tab keeps the list.** Everything hidden is collected in the left column of that tab: click an entry to flash it back into place, double-click to restore it for good, or restore them all at once.
- **Content goes above or below.** The library is one shelf: a block is a block, whether the plugin ships it or you saved it. Place in chooses the zone, and the block you add is selected where it landed, so the picture shows the change immediately.
- **Text reads live values.** `{turns}` `{prompts}` `{date}` `{time}` `{weekday}` `{title}` `{model}` `{session}` `{app}` and `{version}` are filled at capture time from the conversation and the host. Placeholders stay readable while editing, and anything unknown is left untouched.
- **Blocks are adjustable, not fixed.** A divider carries its own weight and the room it keeps above and below; a spacer its height; an image its width and bytes; text its size and alignment. The same fields appear in the inspector, so a block can be tuned where it sits.
- **Images stay in the browser.** A picked file is read into the options as a data URL; anything past 800k characters is refused rather than silently stored.
- **Components.** A component is one block with a name. The five shipped blocks are components the plugin supplies: they can be placed like any other entry, and because they belong to the plugin they cannot be changed or deleted in place. Their `...` opens the designer with a copy, and saving that copy makes it yours. Every field the designer shows is labelled, the live preview is drawn by the picture's own renderer, and saving keeps the entry on the shelf for good.
- **The inspector edits the selection.** Click an element for its tag, selector, a hide switch, an editable name, six style presets (dim, outline, trim spacing, drop background, monospace, small type) and free-form style and attribute rows. Click a block for its fields, a button that saves it to the shelf as a component, and a button that removes it.
- **Right-click anything** for hide, restore, "remove the rule for this element", the divider, the metadata line and "Restore defaults".
- **Done** closes the editor. Every change applies to the next capture; nothing needs a reload.

The dock holds three tabs: content (the blocks of both zones), elements (what is hidden and what the pointer selects) and the library (the shelf and its designer).

## Storage

A rule is `{ selector, name, hide, style, attrs }`; the selector carries it, so it keeps working for every element the selector matches. Blocks are `{ id, kind, zone, ... }` and components are `{ id, name, block }`, stored beside the rules.

Everything lives in this browser's `localStorage` under `chat-screenshot.options`. The plugin registers no host configuration and stores nothing on the server. A stored value that no longer matches an offered one falls back to the nearest choice, and "Restore defaults" returns to the plain picture.

## What it does not do

- The picture contains the conversation only: no sidebar, no composer, no second conversation.
- Content past the canvas budget (about 16000px per side) is scaled down, and the toast states the factor.
- Hover-only controls stay as the live state shows them; the copy never forces a reveal.
- An SVG icon larger than 256px, or one that references an external symbol, is left unpainted so a decode cannot hang.

## How it works

1. The mounted application surface is cloned into a hidden stage that sits in a fixed, zero-sized holder, so the page's scroll geometry never changes and the live interface is never touched.
2. The copy is prepared: images lose their lazy-loading attributes, media that cannot be drawn is dropped, and the element rules are applied as declarations.
3. The blocks for the top and bottom zones are built into the copy from the saved options, with template variables resolved from the conversation.
4. The crop runs from the first turn (or the top zone) to the last one (or the bottom zone), with equal padding on both edges.
5. The copy is rendered through an SVG `foreignObject` loaded as a data URL, which hands layout back to the browser and matches the screen by construction. When that document cannot be decoded, a hand painter reads the browser's boxes and text lines and paints them onto a canvas instead.
6. The PNG goes to the clipboard; a refused or pending write falls back to a download named after the session and the moment.

## Layout

| Path | Role |
| --- | --- |
| `index.js` | Host half: nothing to run, present because a loader entry must be a plugin |
| `src/client/apply.js` | Registration: locale tables, stylesheet, the entries, the settings section |
| `src/client/shell/` | Constants, React access, saved options, message tables, stylesheet, status state |
| `src/client/dom/` | The orchestrators: stage a copy, measure the band, drive the capture |
| `src/client/dom/clone/` | Everything done to the copy: preparation, the rule engine, template variables, the blocks the editor adds |
| `src/client/dom/transcript/` | Reading the conversation: turn bands, history paging, geometry |
| `src/client/render/` | Renderer choice, SVG document, hand painter, crop, canvas budget |
| `src/client/output/` | Clipboard write and download |
| `src/client/views/` | The button body, the right-click menu, the turn chooser, the icons, the settings section |
| `src/client/views/editor/` | The editor: its frame, the dock, the content list, the component designer, the drag helpers, the inspector, the library |
| `src/client/manifest.json` | Bundle order |
| `client.js` | Generated bundle; do not edit |
| `build.mjs` | Joins the parts into `client.js` |
| `checks/` | Structure, language and logic checks, plus a page for the DOM behaviour |

## Development

```bash
node build.mjs            # write client.js from src/client
node build.mjs --watch    # rebuild on change
npm run check             # bundle freshness, structure, i18n, logic
node checks/serve.mjs     # then open http://127.0.0.1:8712/checks/dom.html for the DOM checks
```

Parts are plain ESM modules that node can import on its own. They are joined into one factory scope, so a top-level name must be unique across the bundle, and a part still imports what it uses from a neighbour even though the joined scope would hide a missing import.

Every user-facing string lives in `src/client/shell/i18n.js` and is registered with the client locale service, so the copy follows a language switch without a reload. `checks/i18n.mjs` fails when a key exists in one language only, when a placeholder differs, or when a view asks for a key no table holds.

`client.js` is served under a content revision fixed at composition, so a rebuilt bundle does not reach a running host. Toggle the plugin off and on, then reload the page.

## License

[GNU General Public License v3.0](LICENSE), `GPL-3.0-only`. Copyright (C) 2026 invefa. A redistributed build keeps this license and comes with the corresponding source.
