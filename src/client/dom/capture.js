/**
 * The capture itself: stage a clone of the application surface, crop it to the transcript, render
 * it, and hand the bytes to the caller.
 *
 * The application surface is cloned, not the transcript box. Cloning the transcript alone drops
 * every ancestor between it and the mount point, and the column's width, centring and insets all
 * come from rules that match through that chain, which is why the picture used to have its text
 * jammed against the left edge with the rest left empty. The scroller is kept for the same reason:
 * the transcript's left inset lives on its padding, and absolutely positioned children resolve
 * against it as their containing block.
 */

import {
  BACKGROUND_TOKENS,
  DEBUG_MEASURE,
  HOLDER_ATTRIBUTE,
  IMAGE_TIMEOUT,
  MIN_SCALE,
  MIN_WIDTH,
  SCROLL_ATTRIBUTE,
  STAGE_ATTRIBUTE,
  TURN_ATTRIBUTE,
} from '../shell/const.js'
import { readOptions } from '../shell/options.js'
import { dropChrome, dropSkipped, sanitizeClone } from './clone.js'
import { findLoadOlder } from './paging.js'
import { insertBlocks, insertMeta } from './inserts.js'
import { planCrop } from './band.js'
import { renderStage } from '../render/index.js'
import { captureScale, nextFrame, waitForImages } from '../render/scale.js'
/** The colour the picture starts from: the transcript's own, else a theme token, else the page. */
export function resolveBackground(element) {
  const view = element.ownerDocument.defaultView
  const computed = view.getComputedStyle(element)
  if (computed.backgroundColor !== '' && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    return computed.backgroundColor
  }
  for (const token of BACKGROUND_TOKENS) {
    const value = computed.getPropertyValue(token).trim()
    if (value !== '') return value
  }
  return view.getComputedStyle(element.ownerDocument.documentElement).backgroundColor || '#ffffff'
}

/** The scrolling transcript container an anchor belongs to, or null when there is none. */
export function conversationRoot(anchor) {
  const scroller = anchor.closest(`[${SCROLL_ATTRIBUTE}]`)
  if (scroller === null) return null
  return scroller.clientWidth > 0 ? scroller : null
}

/**
 * Render the loaded conversation to one full-length PNG, or to just the band of flow items pruned
 * by `pruneClone` (one Q&A turn).
 * @param anchor - any element inside the conversation subtree.
 * @param pruneClone - optional; removes everything outside the band from the clone.
 */
export async function captureConversation(anchor, pruneClone) {
  const scroller = anchor.closest(`[${SCROLL_ATTRIBUTE}]`)
  if (scroller === null) throw new Error('conversation not found')
  const doc = scroller.ownerDocument

  const app = doc.getElementById('root') ?? scroller
  const appRect = app.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  const clipLeft = Math.max(0, Math.round(scrollerRect.left - appRect.left))
  const clipWidth = Math.max(MIN_WIDTH, Math.round(scroller.clientWidth))
  const width = Math.max(clipWidth, Math.round(app.clientWidth || appRect.width))
  const height = Math.max(1, Math.round(scroller.scrollHeight))
  if (height <= 1) throw new Error('empty')

  const background = resolveBackground(scroller)
  const contentStyles = doc.defaultView.getComputedStyle(scroller)

  // The stage is painted behind the application so layout stays cheap (a far off-screen box costs
  // seconds), and it holds a clone, so the live transcript and the composer the user may be typing
  // in are untouched. `opacity:0` keeps it from ever flashing into view, whatever stacking context
  // the app builds around it; layout and rects are unaffected.
  const stage = doc.createElement('div')
  stage.setAttribute(STAGE_ATTRIBUTE, 'true')
  stage.style.cssText =
    'position:absolute;left:0;top:0;pointer-events:none;z-index:0;opacity:0;' +
    `width:${width}px;height:${height}px;overflow:hidden;background:${background};` +
    `font-family:${contentStyles.fontFamily};color:${contentStyles.color};`

  const clone = app.cloneNode(true)
  const scrollerClone = clone.hasAttribute(SCROLL_ATTRIBUTE)
    ? clone
    : clone.querySelector(`[${SCROLL_ATTRIBUTE}]`)
  // Cloned subtrees restart every CSS animation they carry. A disclosure that animates open would
  // be caught mid-flight, so the staged copy runs with motion disabled and settles at its final
  // layout. Visibility and containment stay untouched: the app hides collapsed process rows with
  // `content-visibility: hidden`, and forcing those visible paints their text at a zero-height
  // anchor, the very overlap this guard must avoid.
  //
  // Scrollbars are left alone on purpose: a wide table scrolls sideways, and its track is part of
  // what the box looks like. Hiding the track would also widen the content and move every cell.
  const guard = doc.createElement('style')
  guard.textContent =
    `[${STAGE_ATTRIBUTE}] *,` +
    `[${STAGE_ATTRIBUTE}] *::before,` +
    `[${STAGE_ATTRIBUTE}] *::after{` +
    'animation:none !important;transition:none !important;' +
    'scroll-behavior:auto !important;}'
  stage.appendChild(guard)
  stage.appendChild(clone)
  // The stage is the full height of the transcript, so mounting it straight on the body made the
  // document taller than the window for one frame: a scrollbar appeared, the layout reflowed, and
  // the screen jumped. A fixed, zero-sized holder with clipped overflow keeps the clone measurable
  // while leaving the page's scroll geometry untouched.
  const holder = doc.createElement('div')
  holder.setAttribute(HOLDER_ATTRIBUTE, 'true')
  holder.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;' +
    'pointer-events:none;z-index:0;contain:strict;'
  holder.appendChild(stage)
  doc.body.appendChild(holder)

  try {
    const options = readOptions()
    // Pairing first: `sanitizeClone` walks the live tree and the clone in step by child index, so any
    // pruning done before it shifts the indexes and leaves a deeper video or iframe behind, which the
    // SVG path then fails to decode.
    sanitizeClone(app, clone)
    // The composer shares this scroller; `dropSkipped` prunes it at whatever depth the layout puts
    // it, so the seat never reaches the picture.
    dropSkipped(clone)
    dropChrome(clone, options)
    // The paging control belongs to browsing, not to the transcript. It is dropped from the clone so
    // the picture opens on real content.
    const older = findLoadOlder(clone)
    if (older !== null) older.remove()
    if (pruneClone !== undefined) pruneClone(clone)
    // The reader's own header and footer go in after the band is pruned, so a one-turn capture carries
    // them too, and inside the clone, so the SVG serializer sees them.
    const turns = clone.querySelectorAll(`[${TURN_ATTRIBUTE}]`).length
    const blocks = insertBlocks(clone, options, insertMeta(new Date(), turns))
    clone.style.setProperty('width', `${width}px`)
    // `width` has to mean the outer box. The app surface's padding is part of `clientWidth`, so
    // under `content-box` the clone grew by its own horizontal padding, which pushed the transcript
    // right and made the canvas measure wider than the window.
    clone.style.setProperty('box-sizing', 'border-box')
    clone.style.setProperty('height', 'auto')
    clone.style.setProperty('min-height', '0')
    clone.style.setProperty('max-height', 'none')
    clone.style.setProperty('overflow', 'visible')
    clone.style.setProperty('flex', 'none')
    clone.style.setProperty('background', background)
    if (scrollerClone !== null) {
      // The live scroller is a flex child with its own scroll port; inside the staged clone it has
      // to grow to the full transcript instead. Its flex sizing is left alone on purpose:
      // `flex: none` would turn the stretched child into a content-sized box and pull the whole
      // column off centre.
      scrollerClone.style.setProperty('height', `${height}px`)
      scrollerClone.style.setProperty('max-height', 'none')
      scrollerClone.style.setProperty('overflow', 'visible')
    }
    // An image inside a reply decodes after the clone is built, and its box only reaches its real
    // height then. Measuring first reported a shorter transcript for exactly those turns and the
    // crop cut their bottom. Wait for the media, then force one synchronous layout so every rect
    // read below is final.
    await waitForImages(clone, IMAGE_TIMEOUT)
    await nextFrame()
    void clone.offsetHeight

    // A pruned band lays out far shorter than the live transcript, so the final height always comes
    // from the clone itself; the live height is only a floor for the unpruned capture.
    const cloneBox = clone.getBoundingClientRect()
    const cloneHeight = Math.max(1, Math.round(cloneBox.height))
    const measured = pruneClone === undefined ? Math.max(height, cloneHeight) : cloneHeight
    const canvasWidth = clipWidth
    stage.style.width = `${width}px`
    stage.style.height = `${measured}px`
    const scrollerTop = Math.max(0, Math.round(scrollerRect.top - appRect.top))
    let lastTurnBottom = 0
    let firstTurnTop = Number.POSITIVE_INFINITY
    for (const turn of clone.querySelectorAll(`[${TURN_ATTRIBUTE}]`)) {
      const box = turn.getBoundingClientRect()
      if (box.height <= 0) continue
      lastTurnBottom = Math.max(lastTurnBottom, box.bottom - cloneBox.top)
      firstTurnTop = Math.min(firstTurnTop, box.top - cloneBox.top)
    }
    // The last turn is not the end of the transcript. A delivery card, an attachment strip or a
    // file list is laid out after the turn as its own flow item, and cutting at the turn's bottom
    // sliced the last card in half. The flow really ends at the lowest visible child of the scroll
    // port, so that box is measured too and the crop reaches whichever end is lower.
    let contentBottom = 0
    const flowRoot = scrollerClone ?? clone
    for (const child of flowRoot.children) {
      const style = getComputedStyle(child)
      if (style.display === 'none' || style.visibility !== 'visible') continue
      if (style.position === 'fixed') continue
      const box = child.getBoundingClientRect()
      if (box.height > 0) contentBottom = Math.max(contentBottom, box.bottom - cloneBox.top)
    }
    // Start the picture at the first turn instead of the scroll port, then give the bottom the same
    // inset. Cutting above the first turn would slice the previous reply in half, so the
    // transcript's own edge is the cut and the padding comes from both sides in `cropCanvas`. A header
    // the reader added sits above the first turn, so the cut starts at whichever is higher.
    if (blocks.head !== null) {
      firstTurnTop = Math.min(firstTurnTop, blocks.head.getBoundingClientRect().top - cloneBox.top)
    }
    const crop = planCrop({ measured, scrollerTop, firstTurnTop, lastTurnBottom, contentBottom })
    const clipTop = crop.top
    const clipHeight = crop.height
    // `auto` keeps the largest factor the canvas budget allows. A fixed preset only ever lowers that
    // factor: asking for 2x on a transcript that has to be scaled to 0.6x must not overflow the canvas.
    const autoScale = captureScale(canvasWidth, clipHeight)
    const wanted = options.scale === 'auto' ? autoScale : Number(options.scale)
    const scale = Math.max(MIN_SCALE, Math.min(autoScale, Number.isFinite(wanted) ? wanted : autoScale))
    if (DEBUG_MEASURE && typeof console !== 'undefined') {
      console.info('[dsh-screenshot] capture', {
        containerWidth: canvasWidth,
        frameWidth: width,
        clipLeft,
        clipTop,
        clipHeight,
        bottom: Math.round(crop.bottom),
        height: measured,
        scale,
        lastTurnBottom: lastTurnBottom > 0 ? Math.round(lastTurnBottom) : null,
        contentBottom: contentBottom > 0 ? Math.round(contentBottom) : null,
        head: blocks.head !== null,
        foot: blocks.foot !== null,
        rootClass: typeof app.className === 'string' ? app.className : '',
      })
    }

    return await renderStage(stage, clone, {
      width,
      height: measured,
      background,
      scale,
      clip: {
        left: clipLeft,
        top: clipTop,
        width: canvasWidth,
        height: clipHeight,
        pad: options.edge,
      },
    })
  } finally {
    holder.remove()
  }
}
