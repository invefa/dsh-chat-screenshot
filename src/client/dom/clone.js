/**
 * What leaves the clone, and what cannot be painted.
 *
 * Every operation here works on the staged clone, never on the live tree: the composer the user may
 * be typing in, the scroll position and the app's own state stay untouched.
 *
 * One table names the chrome this plugin knows about. It is not a closed list of what can be hidden —
 * `dom/rules.js` applies the reader's own rules to anything else — it is the set of pieces that get a
 * name, a default and a switch out of the box.
 */

import {
  ATTACHMENTS_ATTRIBUTE,
  CLOCK_ROW_ATTRIBUTE,
  HISTORY_ATTRIBUTE,
  PRUNE_DEPTH,
  PROCESS_ATTRIBUTE,
  SKIP_ATTRIBUTES,
  STEP_PROCESS_ATTRIBUTE,
  TO_BOTTOM_SLOT,
  TURN_SPACER_ATTRIBUTE,
  WIDTH_HANDLE_ATTRIBUTE,
} from '../shell/const.js'

/**
 * The chrome pieces a capture can drop, each one tied to the switch that drops it.
 *
 * Selectors are markers, never layout tests: a `nav` is chrome because message markdown cannot
 * produce one, and the paging control keeps its marker after the last page, when it only turns
 * `disabled`. `composer` is the input seat and its counters, which share the transcript's scroller.
 */
export const CHROME_PIECES = [
  { id: 'nav', option: 'hideNav', selectors: ['nav'] },
  {
    id: 'handles',
    option: 'hideHandles',
    selectors: [`[${WIDTH_HANDLE_ATTRIBUTE}]`, `[${TURN_SPACER_ATTRIBUTE}]`],
  },
  { id: 'clock', option: 'hideClock', selectors: [`[${CLOCK_ROW_ATTRIBUTE}]`] },
  {
    id: 'process',
    option: 'hideProcess',
    selectors: [`[${PROCESS_ATTRIBUTE}]`, `[${STEP_PROCESS_ATTRIBUTE}]`],
  },
  { id: 'attachments', option: 'hideAttachments', selectors: [`[${ATTACHMENTS_ATTRIBUTE}]`] },
  { id: 'paging', option: 'hidePaging', selectors: [`[${HISTORY_ATTRIBUTE}]`] },
  {
    id: 'composer',
    option: 'hideComposer',
    selectors: SKIP_ATTRIBUTES.filter((name) => name !== 'data-dsh-screenshot-skip').map(
      (name) => `[${name}]`,
    ),
  },
  { id: 'toBottom', option: 'hideToBottom', selectors: [TO_BOTTOM_SLOT] },
]

/**
 * Live subtrees that must never reach the picture, whatever the switches say.
 *
 * `role="navigation"` is deliberately not pruned: the sidebar carries it, and so do the per-message
 * action rows. Cropping already removes the sidebar, while pruning the role deleted the action icons
 * that the screen shows.
 */
export function isSkipped(node) {
  return node.hasAttribute('data-dsh-screenshot-skip')
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

/** Every element one piece covers, in document order, without duplicates. */
export function pieceElements(clone, piece) {
  const found = []
  for (const selector of piece.selectors) {
    for (const node of clone.querySelectorAll(selector)) {
      if (!found.includes(node)) found.push(node)
    }
  }
  return found
}
