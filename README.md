# dsh-chat-screenshot

A DeepSeek Harness plugin: it renders a conversation to one PNG and copies it to the clipboard.

English | [中文](README.zh-CN.md)

Two entries share one pipeline. The composer toolbar keeps a camera that captures the whole loaded conversation; every finalized reply's action row keeps a camera that captures that one question and its reply. When the browser refuses the clipboard write, the PNG is downloaded instead.

## Entries

| Entry | Seat | Scope |
| --- | --- | --- |
| Whole conversation | `conversation.input.right`, right end of the composer tool row | Everything loaded in the open conversation, after draining the history |
| One turn | `conversation.chat.assistant-actions`, that reply's action row | From the user message that opens the turn through everything up to the next user message |

Both buttons are icon-only, show a spinner while working, flash a check on success, and report the result in a toast above the row.

## Capture pipeline

1. The mounted application surface is cloned into a hidden stage. The stage sits in a fixed, zero-sized holder, so the page's scroll geometry never changes and the live composer is never touched.
2. The clone drops the transcript chrome: the composer seat and stat pills, the turn navigator rail, drag handles, the paging spacer, and each turn's clock and usage row. Which of the optional parts are dropped is a setting; the defaults are the picture this plugin took before the settings existed.
3. The crop runs from the first turn to the last one, and stops above the composer's stat strip. Both edges get the same padding, so the top and bottom margins match.
4. The clone is rendered through an SVG `foreignObject` loaded as a data URL, which hands the layout back to the browser and matches the screen by construction. When that document cannot be decoded, a hand painter reads the browser's boxes and text line rects and paints them onto a canvas instead.
5. The PNG goes to the clipboard. A refused or pending write falls back to a download named after the session and the moment.

Older history is drained first through the chat view's own "load earlier" control. That button does not go away when the history ends: it stays in the layout, turns disabled and changes its label to "start of conversation", so the capture reads the visible label and stops there. When the host cannot deliver a page, the capture proceeds and the toast says the picture covers the loaded turns only.

## Install

```bash
dsh plugin --profile web add D:\Projects\Agent\DSH\Plugin\ChatScreenshot
```

Remove it again:

```bash
dsh plugin --profile web remove dsh-chat-screenshot
```

The plugin id is `dsh-chat-screenshot`. Reload the page after installing.

## Use

1. Open a conversation.
2. Whole conversation: click the camera in the composer toolbar and wait for the "long screenshot copied" toast.
3. One turn: hover the reply, click the camera in its action row, and wait for the "turn screenshot copied" toast.
4. Paste with Ctrl+V anywhere that accepts an image.

A successful copy flashes a check over the icon. When the clipboard is unavailable the picture is downloaded and the icon stays unchanged.

## Settings

Settings > ChatScreenshot holds three groups. Every change applies to the next capture; nothing needs a reload.

| Group | Rows |
| --- | --- |
| Hidden chrome | clock and usage row, thinking and tool rows, attachments, navigator rail, drag handles, back-to-bottom button |
| Added blocks | title, subtitle, footer, the turn and date line, the rule that separates a block from the transcript |
| Layout | alignment, outer margin, scale |

The title, subtitle and footer are plain text and accept `{turns}`, `{date}` and `{time}`. A header is drawn above the first turn and a footer below the last one, inside the cropped area, so they survive the same render path as the conversation.

Choices live in this browser's `localStorage` under `chat-screenshot.options`; the plugin registers no host configuration and stores nothing on the server. A stored value that no longer matches an offered one falls back to the nearest choice, and "Restore defaults" brings back the picture the plugin took before the settings existed.

## Limits

- The picture contains the conversation only: no sidebar, no composer, no other conversation.
- Content past the canvas budget (about 16000px per side) is scaled down, and the toast states the factor.
- Hover-only controls stay hidden in the picture, because the clone renders the live state rather than forcing reveals.
- An SVG icon larger than 256px, or one that references an external symbol, is left unpainted to avoid a hung decode.

## Layout

| Path | Role |
| --- | --- |
| `index.js` | Host half: nothing to run, present because a loader entry must be a plugin |
| `src/client/apply.js` | Registration: locale tables, stylesheet, both entries, the settings section |
| `src/client/shell/` | Constants, React access, saved options, message tables, stylesheet, status state |
| `src/client/dom/` | Clone preparation, history paging, the blocks the settings add, turn band, the capture itself |
| `src/client/render/` | Renderer choice, SVG document, hand painter, crop, canvas budget |
| `src/client/output/` | Clipboard write and download |
| `src/client/views/` | The button body, the two entries, the two icons, the settings section |
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
