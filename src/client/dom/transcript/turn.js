/**
 * One Q&A turn as a band of flow items.
 *
 * The marks come from the host: `data-chat-flow-kind="user"` opens a turn, and the clicked
 * `data-turn-tail` closes it. The band runs from the user message that opens the turn through the
 * tail that owns the control, stopping before the next user message, so no neighbouring turn reaches
 * the picture.
 */

import { TURN_LABEL_CHARS, TURN_TAIL_ATTRIBUTE, USER_FLOW_KIND } from '../../shell/const.js'
import { captureConversation, conversationRoot } from '../capture.js'
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

/**
 * The turns of a conversation, in reading order.
 *
 * A turn is keyed by the user message that opens it, not by the tail: a reply that is still streaming
 * has no tail yet, and the reader asking for "the last turn" while the model is talking means this
 * one. `tail` is null for exactly that open turn.
 * @returns [{ mark, next, tail, label }], one entry per opening message.
 */
export function turnList(root) {
  const marks = [...root.querySelectorAll(`[${USER_FLOW_KIND}]`)]
  const tails = [...root.querySelectorAll(`[${TURN_TAIL_ATTRIBUTE}]`)]
  return marks.map((mark, index) => {
    const next = marks[index + 1] ?? null
    const tail = tails.find((candidate) => precedes(mark, candidate) && (next === null || precedes(candidate, next))) ?? null
    return { mark, next, tail, label: markLabel(mark) }
  })
}

/** The opening message collapsed to one line, clipped for a menu row. */
function markLabel(mark) {
  const text = (mark.textContent ?? '').replace(/\s+/gu, ' ').trim()
  return text.length <= TURN_LABEL_CHARS ? text : `${text.slice(0, TURN_LABEL_CHARS - 1)}…`
}

/**
 * The flow units one turn owns. A closed turn takes the tail band, which stops before the next user
 * message; an open one has no tail to stop at, so it runs from its opening message to the end of the
 * container the message sits in.
 */
export function turnBandOf(root, entry) {
  if (entry.tail !== null) return turnBand(entry.tail, root)
  const container = entry.mark.parentElement
  if (container === null) return null
  const units = [...container.children]
  const unit = units.find((child) => child === entry.mark || child.contains(entry.mark))
  const start = units.indexOf(unit)
  if (start < 0) return null
  return { container, keep: new Set(units.slice(start)) }
}

/**
 * Keep only the selected turns in a tree that mirrors the conversation.
 *
 * The bands are resolved in the given root, keyed by the same opening-message index, and the kept
 * units of every selected band are unioned before anything is removed — a turn whose band shares a
 * container with another selected turn must not delete that turn's units.
 * @param indices - indexes into `turnList(root)`.
 * @returns whether any band was found at all.
 */
export function pruneTurns(root, indices) {
  const entries = turnList(root)
  const picked = [...new Set(indices)].filter((index) => entries[index] !== undefined).sort((a, b) => a - b)
  if (picked.length === 0) return false
  const containers = new Map()
  let found = false
  for (const index of picked) {
    const band = turnBandOf(root, entries[index])
    if (band === null) continue
    found = true
    const keep = containers.get(band.container) ?? new Set()
    for (const unit of band.keep) keep.add(unit)
    containers.set(band.container, keep)
  }
  if (!found) return false
  for (const [container, keep] of containers) {
    for (const unit of [...container.children]) {
      if (!keep.has(unit)) unit.remove()
    }
  }
  return true
}

/**
 * Render several turns of one conversation to a single PNG, in the order they appear.
 * @param indices - indexes into `turnList(root)`; the last one anchors the crop.
 */
export async function captureTurns(root, indices) {
  const entries = turnList(root)
  const picked = [...new Set(indices)].filter((index) => entries[index] !== undefined).sort((a, b) => a - b)
  if (picked.length === 0) throw new Error('turn not found')
  for (const index of picked) {
    if (turnBandOf(root, entries[index]) === null) throw new Error('turn not found')
  }
  const anchor = entries[picked[picked.length - 1]].mark
  return captureConversation(anchor, (clone) => {
    if (!pruneTurns(clone, picked)) throw new Error('turn not found')
  })
}
