/**
 * The edit surface: a stand-in conversation, laid out in the conversation's own place.
 *
 * It is built exactly the way a capture is built — the same clone, the same chrome table, the same
 * inserted blocks — with two differences: the chrome the reader switched off stays in the copy (dimmed
 * and tagged, so a click brings it back), and the copy is laid out at full length inside a scrolling
 * frame instead of being flattened into one tall canvas. What the reader sees while editing is
 * therefore the very clone the renderer would paint, which is as close to "what you see is what you
 * get" as a DOM copy gets.
 *
 * Nothing here writes to the live tree: the copy is a clone, so a click on a link or a button inside
 * it cannot reach the application.
 */

import {
  DEBUG_MEASURE,
  EDITOR_ATTRIBUTE,
  HOLDER_ATTRIBUTE,
  MIN_WIDTH,
  SCROLL_ATTRIBUTE,
  STAGE_ATTRIBUTE,
  TURN_ATTRIBUTE,
} from '../shell/const.js'
import { dropSkipped, paintChrome, sanitizeClone } from './clone.js'
import { RAW_META, insertBlocks } from './inserts.js'
import { resolveBackground } from './capture.js'

/** Overlay, frame and clone in one tree; the caller only has to mount `element`. */
function shell(doc, background, fontFamily, color) {
  const element = doc.createElement('div')
  element.setAttribute(EDITOR_ATTRIBUTE, 'true')
  element.className = 'cs-ed'
  element.style.setProperty('background', background)
  element.style.setProperty('font-family', fontFamily)
  element.style.setProperty('color', color)

  const scroll = doc.createElement('div')
  scroll.className = 'cs-ed-scroll'

  const frame = doc.createElement('div')
  frame.className = 'cs-ed-frame'

  const stage = doc.createElement('div')
  stage.setAttribute(STAGE_ATTRIBUTE, 'edit')
  stage.className = 'cs-ed-stage'

  // Animations restart in a clone, so a disclosure that animates open would be caught mid-flight and
  // measured at the wrong height. Same guard as the capture, for the same reason.
  const guard = doc.createElement('style')
  guard.textContent =
    `.cs-ed-stage *,.cs-ed-stage *::before,.cs-ed-stage *::after{` +
    'animation:none !important;transition:none !important;scroll-behavior:auto !important;}'

  frame.appendChild(guard)
  frame.appendChild(stage)
  scroll.appendChild(frame)
  element.appendChild(scroll)
  return { element, scroll, frame, stage }
}

/**
 * Build the edit surface for a conversation.
 *
 * @param anchor - any element inside the conversation subtree.
 * @param options - the reader's current switches.
 * @param labels - the placeholders the inserted fields show when empty.
 * @returns {{ element, clone, head, foot, destroy }} the mounted overlay and its parts.
 */
export function buildStage(anchor, options, labels) {
  const scroller = anchor.closest(`[${SCROLL_ATTRIBUTE}]`)
  if (scroller === null) throw new Error('conversation not found')
  const doc = scroller.ownerDocument
  const app = doc.getElementById('root') ?? scroller

  const appRect = app.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  const clipLeft = Math.max(0, Math.round(scrollerRect.left - appRect.left))
  const clipWidth = Math.max(MIN_WIDTH, Math.round(scroller.clientWidth))
  const width = Math.max(clipWidth, Math.round(app.clientWidth || appRect.width))
  const background = resolveBackground(scroller)
  const styles = doc.defaultView.getComputedStyle(scroller)

  const parts = shell(doc, background, styles.fontFamily, styles.color)

  // The clone lives outside the application while it is edited, so it is wrapped in the same holder
  // the capture uses: a zero-sized, clipped box that keeps the document's scroll geometry untouched.
  // Here it is not fixed, because the reader has to see and scroll it.
  const holder = doc.createElement('div')
  holder.setAttribute(HOLDER_ATTRIBUTE, 'edit')
  holder.className = 'cs-ed-holder'

  const clone = app.cloneNode(true)
  const scrollerClone = clone.hasAttribute(SCROLL_ATTRIBUTE)
    ? clone
    : clone.querySelector(`[${SCROLL_ATTRIBUTE}]`)

  sanitizeClone(app, clone)
  dropSkipped(clone)
  paintChrome(clone, options)
  const turns = clone.querySelectorAll(`[${TURN_ATTRIBUTE}]`).length
  const blocks = insertBlocks(clone, options, { ...RAW_META, turns }, labels)

  clone.style.setProperty('width', `${width}px`)
  clone.style.setProperty('box-sizing', 'border-box')
  clone.style.setProperty('height', 'auto')
  clone.style.setProperty('min-height', '0')
  clone.style.setProperty('max-height', 'none')
  clone.style.setProperty('overflow', 'visible')
  clone.style.setProperty('flex', 'none')
  clone.style.setProperty('background', background)
  // The frame shows the transcript column only, so the copy is shifted by the same inset the crop
  // uses; the sidebar the copy still carries then sits outside the visible area.
  clone.style.setProperty('margin-left', `${-clipLeft}px`)
  if (scrollerClone !== null) {
    scrollerClone.style.setProperty('height', 'auto')
    scrollerClone.style.setProperty('max-height', 'none')
    scrollerClone.style.setProperty('overflow', 'visible')
  }

  holder.appendChild(clone)
  parts.stage.appendChild(holder)
  parts.frame.style.setProperty('width', `${clipWidth}px`)
  parts.frame.style.setProperty('--cs-edge', `${options.edge}px`)

  if (DEBUG_MEASURE && typeof console !== 'undefined') {
    console.info('[dsh-screenshot] editor', {
      width,
      clipWidth,
      clipLeft,
      turns,
      head: blocks.head !== null,
      foot: blocks.foot !== null,
    })
  }

  const destroy = () => {
    holder.remove()
    parts.element.remove()
  }

  return { element: parts.element, scroll: parts.scroll, clone, head: blocks.head, foot: blocks.foot, destroy }
}
