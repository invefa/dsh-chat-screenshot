/**
 * Document-order questions the turn band asks.
 */

/** Whether `a` comes before `b` in document order; a node never precedes itself. */
export function precedes(a, b) {
  return a !== b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/** The deepest element that contains both nodes, or null when they share no ancestor. */
export function deepestCommonAncestor(a, b) {
  for (let node = a.parentElement; node !== null; node = node.parentElement) {
    if (node.contains(b)) return node
  }
  return null
}
