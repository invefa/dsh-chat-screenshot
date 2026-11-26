/**
 * One Q&A turn as a band of flow items.
 *
 * The marks come from the host: `data-chat-flow-kind="user"` opens a turn, and the clicked
 * `data-turn-tail` closes it. The band runs from the user message that opens the turn through the
 * tail that owns the control, stopping before the next user message, so no neighbouring turn reaches
 * the picture.
 */

import { TURN_TAIL_ATTRIBUTE, USER_FLOW_KIND } from '../shell/const.js'
import { captureConversation, conversationRoot } from './capture.js'
import { deepestCommonAncestor, precedes } from './geometry.js'
/**
 * @returns the container plus the units to keep, or null when the marks do not line up.
 */
export function turnBand(turnEl, root) {
  const marks = [...root.querySelectorAll(`[${USER_FLOW_KIND}]`)]
  let startMark = null
  let endMark = null
  for (const mark of marks) {
    if (startMark === null || precedes(mark, turnEl)) {
      if (startMark === null || precedes(startMark, mark)) startMark = mark
    } else if (precedes(turnEl, mark)) {
      endMark = mark
      break
    }
  }
  if (startMark === null) return null
  const container = deepestCommonAncestor(startMark, turnEl)
  if (container === null) return null
  const units = [...container.children]
  const unitOf = (el) => {
    for (let node = el; node !== null && node.parentElement !== null; node = node.parentElement) {
      if (node.parentElement === container) return units.indexOf(node)
    }
    return -1
  }
  const start = unitOf(startMark)
  let end = unitOf(turnEl)
  if (start < 0 || end < 0) return null
  if (endMark !== null) {
    const stop = unitOf(endMark)
    if (stop > start) end = Math.max(end, stop - 1)
  }
  return { container, keep: new Set(units.slice(start, end + 1)) }
}

/**
 * Render one Q&A turn to a PNG. The band is resolved independently in the clone (same structure,
 * same mark order), keyed by the clicked tail's index among the turn tails.
 * @param turnEl - the `[data-turn-tail]` wrapper that owns the control.
 */
export async function captureTurn(turnEl) {
  const root = conversationRoot(turnEl)
  if (root === null) throw new Error('conversation not found')
  const tailIndex = [...root.querySelectorAll(`[${TURN_TAIL_ATTRIBUTE}]`)].indexOf(turnEl)
  if (tailIndex < 0) throw new Error('turn not found')
  if (turnBand(turnEl, root) === null) throw new Error('turn not found')
  return captureConversation(turnEl, (clone) => {
    const cloneTurn = [...clone.querySelectorAll(`[${TURN_TAIL_ATTRIBUTE}]`)][tailIndex] ?? null
    const band = cloneTurn === null ? null : turnBand(cloneTurn, clone)
    if (band === null) throw new Error('turn not found')
    for (const unit of [...band.container.children]) {
      if (!band.keep.has(unit)) unit.remove()
    }
  })
}
