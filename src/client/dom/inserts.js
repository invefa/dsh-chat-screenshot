/**
 * The picture's own content: the blocks the reader placed above and below the transcript.
 *
 * They are built inside the staged clone, not around it: both renderers read the clone and the SVG
 * path serializes only that element, so a block mounted next to it would be laid out and then left
 * out of the picture. Each zone is a wrapper the crop can measure, and each block carries the id it
 * was placed under, which is what lets the editor select, drag and delete the one under the pointer.
 *
 * Colours are literal greys on purpose. `var(--dsw-alias-*)` resolves in the live page, which is what
 * the hand painter reads, but the serialized SVG document has no theme root to resolve against, so a
 * token here would draw one way through the fallback and another through the main path. A neutral grey
 * reads on both light and dark transcripts; body text keeps `color: inherit`, so it follows the
 * transcript in either theme.
 */

import {
  BLOCK_ATTRIBUTE,
  FIELD_ATTRIBUTE,
  FOOT_ATTRIBUTE,
  HEAD_ATTRIBUTE,
  SCROLL_ATTRIBUTE,
  ZONE_ATTRIBUTE,
} from '../shell/const.js'
import { translate } from '../shell/i18n.js'
import { renderTemplate } from './tokens.js'

/** Muted copy and hairline rules, chosen to stay legible on a light and on a dark transcript. */
const ZONE_ATTRIBUTES = { top: HEAD_ATTRIBUTE, bottom: FOOT_ATTRIBUTE }

/** One grey that reads the same on both themes; a capture has no theme tokens to resolve. */
const MUTED = '#8c8c8c'
const RULE = 'rgba(128, 128, 128, .32)'

/** The metrics of one text block per size, so a picture keeps one type scale. */
const TEXT_STYLE = {
  title: 'font-size:17px;line-height:24px;font-weight:600;color:inherit;',
  subtitle: `font-size:13px;line-height:20px;color:${MUTED};`,
  body: 'font-size:13px;line-height:20px;color:inherit;',
}

/** The zone's own breathing room, and which side of the transcript it hugs. */
const ZONE_STYLE = {
  top: 'padding:0 0 12px;',
  bottom: 'padding:12px 0 0;',
}

/**
 * Turn one element into an editable field, in place.
 *
 * `contenteditable="plaintext-only"` keeps a paste from arriving with markup the picture cannot paint,
 * and the attribute that tags the field is also what the overlay listens for when it writes the value
 * back. An empty field carries its hint in an attribute, so CSS can draw it and `textContent` stays
 * empty: the saved value is never the hint.
 */
function editable(doc, node, id, placeholder) {
  node.setAttribute('contenteditable', 'plaintext-only')
  node.setAttribute('spellcheck', 'false')
  node.setAttribute(FIELD_ATTRIBUTE, id)
  node.setAttribute('data-cs-placeholder', placeholder)
  node.classList.add('cs-ed-field')
  if (node.textContent === '') node.setAttribute('data-empty', 'true')
  return node
}

/** One block, drawn the way both renderers will see it. Null when a capture has nothing to draw. */
function renderBlock(doc, block, values, labels) {
  const edit = labels === null ? null : labels
  const shell = doc.createElement('div')
  shell.setAttribute(BLOCK_ATTRIBUTE, block.id)
  shell.className = `cs-blk cs-blk-${block.kind}`
  shell.style.cssText = 'display:block;box-sizing:border-box;'

  if (block.kind === 'spacer') {
    shell.style.height = `${block.height}px`
    if (edit !== null) {
      shell.classList.add('cs-blk-space')
      shell.appendChild(doc.createTextNode(''))
    }
    return shell
  }

  if (block.kind === 'divider') {
    shell.style.cssText += `border-top:1px solid ${RULE};height:0;`
    if (edit !== null) shell.classList.add('cs-blk-space')
    return shell
  }

  if (block.kind === 'image') {
    if (block.src === '') {
      if (edit === null) return null
      shell.classList.add('cs-blk-empty')
      shell.setAttribute('data-cs-placeholder', labels.image)
      shell.style.cssText += 'padding:18px 0;text-align:center;'
      return shell
    }
    const image = doc.createElement('img')
    image.src = block.src
    image.style.cssText = `display:block;width:${block.width}%;height:auto;margin:0 auto;`
    shell.appendChild(image)
    return shell
  }

  if (block.kind === 'meta') {
    const line = translate('insert.meta', {
      turns: values.turns === '' ? '—' : values.turns,
      date: values.date,
      time: values.time,
    })
    shell.style.cssText += `${TEXT_STYLE.subtitle}text-align:${block.align ?? 'left'};`
    shell.textContent = line
    return shell
  }

  const text = edit === null ? renderTemplate(block.text, values) : block.text
  if (edit === null && text === '') return null
  shell.style.cssText += `${TEXT_STYLE[block.size]}text-align:${block.align};white-space:pre-wrap;word-break:break-word;`
  shell.textContent = text
  return edit === null ? shell : editable(doc, shell, block.id, labels.text)
}

/**
 * One zone: the blocks that live above or below the transcript, in the order they were placed.
 *
 * A capture drops the whole wrapper when the zone holds nothing; the edit surface always builds it,
 * because an empty zone is where a dragged block lands.
 */
export function buildZone(doc, zone, options, values, labels = null) {
  const edit = labels === null ? null : labels
  const held = options.blocks.filter((block) => block.zone === zone)
  if (edit === null && held.length === 0) return null
  const wrapper = doc.createElement('div')
  wrapper.setAttribute(ZONE_ATTRIBUTE, zone)
  wrapper.setAttribute(ZONE_ATTRIBUTES[zone], 'true')
  wrapper.className = `cs-blk-zone cs-blk-zone-${zone}`
  wrapper.style.cssText = `display:block;box-sizing:border-box;${ZONE_STYLE[zone]}`
  let painted = 0
  for (const block of held) {
    const node = renderBlock(doc, block, values, labels)
    if (node === null) continue
    wrapper.appendChild(node)
    painted += 1
  }
  if (edit !== null && painted === 0) {
    wrapper.classList.add('cs-blk-zone-empty')
    wrapper.setAttribute('data-cs-placeholder', labels.zone)
  }
  return wrapper
}

/**
 * Put both zones in place inside the clone and hand them back for measuring.
 *
 * @param values - the token values for this capture, from `tokenValues`.
 * @param labels - the edit surface's placeholders, or null for a capture.
 * @returns {{ head: Element | null, foot: Element | null }}
 */
export function insertBlocks(clone, options, values, labels = null) {
  const flow =
    (clone.hasAttribute(SCROLL_ATTRIBUTE) ? clone : clone.querySelector(`[${SCROLL_ATTRIBUTE}]`)) ?? clone
  const doc = clone.ownerDocument
  const head = buildZone(doc, 'top', options, values, labels)
  const foot = buildZone(doc, 'bottom', options, values, labels)
  if (head !== null) flow.insertBefore(head, flow.firstChild)
  if (foot !== null) flow.appendChild(foot)
  return { head, foot }
}


