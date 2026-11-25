/**
 * The blocks the settings can add above and below the transcript: a title, a subtitle, a footer and
 * the one metadata line that says how much of the conversation the picture holds.
 *
 * They are built inside the staged clone, not around it: both renderers read the clone and the SVG
 * path serializes only that element, so a header mounted next to it would be laid out and then left
 * out of the picture.
 *
 * Colours are literal greys on purpose. `var(--dsw-alias-*)` resolves in the live page, which is what
 * the hand painter reads, but the serialized SVG document has no theme root to resolve against, so a
 * token here would draw one way through the fallback and another through the main path. A neutral grey
 * reads on both light and dark transcripts; the body text keeps `color: inherit`, so it follows the
 * transcript in either theme.
 */

import { FOOT_ATTRIBUTE, HEAD_ATTRIBUTE, SCROLL_ATTRIBUTE } from '../shell/const.js'
import { translate } from '../shell/i18n.js'
/** Muted copy and hairline rules, chosen to stay legible on a light and on a dark transcript. */
const MUTED = '#8c8c8c'
const RULE = 'rgba(128, 128, 128, .32)'

/** Two decimal digits, so a meta line never jumps in width between 9 and 10. */
function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * The values `{date}`, `{time}` and `{turns}` stand for, taken at capture time.
 * @param {Date} now - the moment the picture is taken.
 * @param {number} turns - how many exchanges the picture covers.
 */
export function insertMeta(now, turns) {
  return {
    turns: Math.max(0, Math.round(turns)),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

/** Substitute the placeholders a reader may write into a title or a footer. */
export function fillTokens(text, meta) {
  return text
    .replace(/\{turns\}/g, String(meta.turns))
    .replace(/\{date\}/g, meta.date)
    .replace(/\{time\}/g, meta.time)
}

/** One block of text with the geometry both renderers agree on. */
function paragraph(doc, text, style, align) {
  const node = doc.createElement('div')
  node.textContent = text
  node.style.cssText = `display:block;text-align:${align};white-space:pre-wrap;word-break:break-word;${style}`
  return node
}

/** The header block, or null when the reader asked for neither a title nor a subtitle. */
export function buildHead(doc, options, meta) {
  const title = fillTokens(options.title, meta)
  const subtitle = fillTokens(options.subtitle, meta)
  if (title === '' && subtitle === '') return null
  const box = doc.createElement('div')
  box.setAttribute(HEAD_ATTRIBUTE, 'true')
  box.style.cssText =
    `display:block;box-sizing:border-box;padding:2px 0 ${options.divider ? 16 : 12}px;` +
    `text-align:${options.align};` +
    (options.divider ? `border-bottom:1px solid ${RULE};` : '')
  if (title !== '') {
    box.appendChild(
      paragraph(doc, title, 'font-size:17px;line-height:24px;font-weight:600;color:inherit;', options.align),
    )
  }
  if (subtitle !== '') {
    box.appendChild(
      paragraph(doc, subtitle, `margin-top:4px;font-size:13px;line-height:20px;color:${MUTED};`, options.align),
    )
  }
  return box
}

/** The footer block, or null when the reader asked for neither a footer nor the metadata line. */
export function buildFoot(doc, options, meta) {
  const footer = fillTokens(options.footer, meta)
  if (footer === '' && !options.showMeta) return null
  const box = doc.createElement('div')
  box.setAttribute(FOOT_ATTRIBUTE, 'true')
  box.style.cssText =
    `display:block;box-sizing:border-box;padding:${options.divider ? 16 : 12}px 0 2px;` +
    `text-align:${options.align};` +
    (options.divider ? `border-top:1px solid ${RULE};` : '')
  if (footer !== '') {
    box.appendChild(
      paragraph(doc, footer, 'font-size:13px;line-height:20px;color:inherit;', options.align),
    )
  }
  if (options.showMeta) {
    const meta1 = translate('insert.meta', { turns: meta.turns, date: meta.date, time: meta.time })
    box.appendChild(
      paragraph(doc, meta1, `margin-top:4px;font-size:12px;line-height:18px;color:${MUTED};`, options.align),
    )
  }
  return box
}

/**
 * Put both blocks in place inside the clone and hand them back for measuring.
 * @returns {{ head: Element | null, foot: Element | null }}
 */
export function insertBlocks(clone, options, meta) {
  const flow =
    (clone.hasAttribute(SCROLL_ATTRIBUTE) ? clone : clone.querySelector(`[${SCROLL_ATTRIBUTE}]`)) ?? clone
  const doc = clone.ownerDocument
  const head = buildHead(doc, options, meta)
  const foot = buildFoot(doc, options, meta)
  if (head !== null) flow.insertBefore(head, flow.firstChild)
  if (foot !== null) flow.appendChild(foot)
  return { head, foot }
}
