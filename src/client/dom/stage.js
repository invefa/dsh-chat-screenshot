/**
 * The edit surface: a stand-in conversation, laid out in the conversation's own place.
 *
 * It is built exactly the way a capture is built — the same clone, the same rules, the same inserted
 * blocks — with two differences: the copy is laid out at full length inside a scrolling frame instead
 * of being flattened into one tall canvas, and every rule that hides an element is reversible here,
 * because the element keeps its place in the copy with no box and the surface can point at the hole.
 * What the reader sees while editing is therefore the very clone the renderer would paint, which is
 * as close to "what you see is what you get" as a DOM copy gets.
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
import { pieceBottom } from './transcript/band.js'
import { dropSkipped, sanitizeClone } from './clone/prepare.js'
import { applyRules } from './clone/rules.js'
import { insertBlocks } from './clone/inserts.js'
import { tokenValues } from './clone/tokens.js'
import { resolveBackground } from './capture.js'

/**
 * The band the capture would cut, measured in the copy.
 *
 * The overlay must not show the whole application surface: the copy carries the conversation header,
 * the tab row and the sidebar, and none of them are in the picture. Cutting the frame to the same
 * band `planCrop` cuts means the reader is looking at the photograph, not at the window — and a
 * control that cannot appear in the picture cannot be pointed at here either.
 *
 * @returns {{top: number, bottom: number}} edges in the copy's coordinate space.
 */
function measureBand(doc, clone, scrollerClone, head) {
  const box = clone.getBoundingClientRect()
  let top = Number.POSITIVE_INFINITY
  let bottom = 0
  for (const turn of clone.querySelectorAll(`[${TURN_ATTRIBUTE}]`)) {
    const rect = turn.getBoundingClientRect()
    if (rect.height <= 0) continue
    top = Math.min(top, rect.top - box.top)
    bottom = Math.max(bottom, rect.bottom - box.top)
  }
  // A header the reader added sits above the first turn, so the picture starts at whichever is higher.
  if (head !== null) top = Math.min(top, head.getBoundingClientRect().top - box.top)
  // Cards, attachment strips and file lists are laid out after the last turn as their own flow items.
  const flow = scrollerClone ?? clone
  const view = doc.defaultView
  for (const child of flow.children) {
    const style = view.getComputedStyle(child)
    if (style.display === 'none' || style.visibility !== 'visible' || style.position === 'fixed') continue
    const rect = child.getBoundingClientRect()
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom - box.top)
  }
  bottom = Math.max(bottom, pieceBottom(clone, box.top, 'composer'))
  if (!Number.isFinite(top)) top = 0
  if (bottom <= 0) bottom = box.height
  return { top: Math.max(0, Math.floor(top)), bottom: Math.ceil(Math.min(bottom, box.height)) }
}

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
 * @returns {{ element, clone, head, foot, frame, destroy }} the overlay and its parts; `frame()` crops the
 *   view to the picture and must be called once `element` is in the document.
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
  const applied = applyRules(clone, options)
  const turns = clone.querySelectorAll(`[${TURN_ATTRIBUTE}]`).length
  // The edit surface shows the templates as written: a header has to stay editable, so `{date}` here
  // is the placeholder rather than the day it would print.
  const blocks = insertBlocks(clone, options, { ...tokenValues(doc), turns: String(turns) }, labels)

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
    // The application stores its column heights as inline pixels, measured from the window when it
    // laid itself out. A copy that is meant to run at its natural length must not inherit them: the
    // transcript would keep the window's height and leave a pool of empty space below the last turn.
    // Every ancestor of the transcript is therefore released back to its content.
    let node = scrollerClone
    while (node !== null) {
      node.style.setProperty('height', 'auto')
      node.style.setProperty('min-height', '0')
      node.style.setProperty('max-height', 'none')
      node.style.setProperty('flex', 'none')
      node.style.setProperty('overflow', 'visible')
      if (node === clone) break
      node = node.parentElement
    }
  }

  holder.appendChild(clone)
  parts.stage.appendChild(holder)
  parts.frame.style.setProperty('width', `${clipWidth}px`)
  parts.frame.style.setProperty('--cs-edge', `${options.edge}px`)

  // Frame the picture: shift the copy up to the band's top and let the frame be exactly as tall as
  // the band, clipping everything above and below it. This has to run after the caller has mounted
  // `element`, because a detached tree has no boxes to measure — every rect reads zero and the frame
  // collapses. The caller therefore mounts first and calls `frame()` right after.
  const frame = () => {
    const band = measureBand(doc, clone, scrollerClone, blocks.head)
    parts.stage.style.setProperty('margin-top', `${-band.top}px`)
    parts.frame.style.setProperty('height', `${Math.max(1, band.bottom - band.top)}px`)
    if (DEBUG_MEASURE && typeof console !== 'undefined') {
      console.info('[dsh-screenshot] editor', {
        width,
        clipWidth,
        clipLeft,
        bandTop: band.top,
        bandBottom: band.bottom,
        turns,
        head: blocks.head !== null,
        foot: blocks.foot !== null,
      })
    }
    return band
  }

  const destroy = () => {
    holder.remove()
    parts.element.remove()
  }

  return {
    element: parts.element,
    scroll: parts.scroll,
    clone,
    head: blocks.head,
    foot: blocks.foot,
    entries: applied.entries,
    frame,
    frameElement: parts.frame,
    destroy,
  }
}
