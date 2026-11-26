/**
 * What leaves the clone, and what cannot be painted.
 *
 * Every operation here works on the staged clone, never on the live tree: the composer the user may
 * be typing in, the scroll position and the app's own state stay untouched.
 */

import {
  CLOCK_ROW_ATTRIBUTE,
  PRUNE_DEPTH,
  SKIP_ATTRIBUTES,
  TO_BOTTOM_SLOT,
  TURN_SPACER_ATTRIBUTE,
  WIDTH_HANDLE_ATTRIBUTE,
} from '../shell/const.js'
/**
 * Live subtrees that must never reach the picture.
 *
 * `role="navigation"` is deliberately not pruned: the sidebar carries it, and so do the per-message
 * action rows. Cropping already removes the sidebar, while pruning the role deleted the action icons
 * that the screen shows.
 */
export function isSkipped(node) {
  return SKIP_ATTRIBUTES.some((name) => node.hasAttribute(name))
}

/**
 * Prune skipped descendants from the clone. The painter reads the clone, so the live elements —
 * including the composer the user may be typing in — are never touched.
 */
export function dropSkipped(clone, depth = PRUNE_DEPTH) {
  for (const child of [...clone.children]) {
    if (isSkipped(child)) child.remove()
    else if (depth > 0) dropSkipped(child, depth - 1)
  }
}

/**
 * Replace media the renderers cannot paint and drop the ones they must not: a video, iframe or
 * plugin surface inside a transcript would either stay blank or taint the canvas.
 */
export function sanitizeClone(live, clone) {
  const liveChildren = live.children
  const cloneChildren = clone.children
  for (let index = 0; index < cloneChildren.length; index += 1) {
    const child = cloneChildren[index]
    const source = liveChildren[index]
    if (child.tagName === 'IMG') {
      child.removeAttribute('loading')
      child.removeAttribute('decoding')
      child.removeAttribute('srcset')
      child.removeAttribute('sizes')
      continue
    }
    if (
      child.tagName === 'VIDEO' ||
      child.tagName === 'AUDIO' ||
      child.tagName === 'IFRAME' ||
      child.tagName === 'OBJECT'
    ) {
      child.remove()
      continue
    }
    if (source !== undefined) sanitizeClone(source, child)
  }
}

/**
 * Drop the transcript's chrome from the clone: the turn navigator rail, drag handles, the paging
 * spacer and the per-turn metadata row. Cropping cannot remove these because they sit in the
 * transcript's flow; they are deleted by marker instead.
 */
export function dropChrome(clone) {
  // The turn navigator is a `nav` rail pinned to the transcript's right edge: a stack of tick marks,
  // one per turn. It is chrome, and it shrinks with the band, so a short capture left a few ticks
  // beside the content. Every `nav` in the clone is chrome, because message markdown cannot produce
  // one; the earlier size test left the short rail behind.
  for (const nav of clone.querySelectorAll('nav')) nav.remove()
  for (const handle of clone.querySelectorAll(`[${WIDTH_HANDLE_ATTRIBUTE}]`)) handle.remove()
  for (const spacer of clone.querySelectorAll(`[${TURN_SPACER_ATTRIBUTE}]`)) spacer.remove()
  // Every turn ends with a metadata row: clock, per-turn usage, and the hover-only action icons.
  // The host marks both rows with data-clock, the user's message with "start" and the answer with
  // "end"; both are chrome, and a capture of a conversation does not need the time of day.
  for (const row of clone.querySelectorAll(`[${CLOCK_ROW_ATTRIBUTE}]`)) row.remove()
  // The "back to bottom" button floats over the transcript's lower right corner once the reader has
  // scrolled away from the tail. It belongs to browsing, not to the conversation, and a capture is
  // always taken with the whole transcript laid out, so the control has no place in the picture.
  for (const slot of clone.querySelectorAll(TO_BOTTOM_SLOT)) slot.remove()
}
