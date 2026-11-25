/**
 * Draining the transcript's history before the picture is taken.
 *
 * Paging is driven from the chat view's own control. A page can take several seconds to land and the
 * host's prepend pipeline can fail one fetch while later ones succeed, so the control is re-clicked
 * while it reports that older pages exist. The control does not unmount when the history runs out: it
 * stays in the layout, turns `disabled` and swaps its visible label for "start of conversation". That
 * distinction is the whole point of `readPaging` — reading only "is there a control" clicked a
 * disabled button for the length of the budget while the entry claimed it was still loading, which is
 * exactly what a reader saw when the picture never arrived.
 */

import {
  HISTORY_BUDGET,
  PAGE_EFFECT_TIMEOUT,
  PAGING_STATES,
  SCROLL_ATTRIBUTE,
  STABLE_TICKS,
  STABLE_TICK_MS,
} from '../../shell/const.js'
/** Longest label the control may carry and still count as the paging control. */
const MAX_LABEL = 24

/**
 * The text a reader actually sees: subtrees the host marks `aria-hidden` (or hides outright) carry
 * the four labels the button is not showing, so a plain `textContent` reads all five at once.
 */
function visibleLabel(element) {
  const parts = []
  const walk = (node) => {
    if (node.nodeType === 3) {
      parts.push(node.nodeValue ?? '')
      return
    }
    if (node.nodeType !== 1) return
    if (node.getAttribute('aria-hidden') === 'true' || node.hidden === true) return
    for (const child of node.childNodes) walk(child)
  }
  walk(element)
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The state one label reports, or null when the text is something else entirely.
 *
 * The comparison is exact. A prefix test read the five concatenated labels as "load more" and kept
 * clicking a control that had nothing left to fetch; the labels the host renders are fixed strings, so
 * there is nothing a prefix would buy.
 */
export function classifyPaging(label) {
  if (label === '' || label.length > MAX_LABEL) return null
  for (const entry of PAGING_STATES) {
    if (entry.labels.includes(label)) return entry.state
  }
  return null
}

/**
 * The paging control and the state it reports, or null when the transcript shows no such control.
 * @returns {{ control: Element, state: string, disabled: boolean } | null}
 */
export function readPaging(root) {
  for (const candidate of root.querySelectorAll('button, [role="button"]')) {
    const label = visibleLabel(candidate)
    if (label === '' || label.length > MAX_LABEL) continue
    const state = classifyPaging(label)
    if (state === null) continue
    const flag = candidate.getAttribute('aria-disabled')
    return {
      control: candidate,
      state,
      disabled: candidate.disabled === true || flag === 'true',
    }
  }
  return null
}

/**
 * The control to click, or null when nothing older is waiting to be fetched. A disabled control and
 * the `start` state both mean the history is complete, so neither is offered as a click target.
 *
 * A control that reports `busy` is not a click target either: the host is already fetching a page,
 * and clicking again lands a second request on top of the first one.
 */
export function findLoadOlder(root) {
  const paging = readPaging(root)
  if (paging === null || paging.disabled || paging.state === 'start') return null
  if (paging.state === 'busy') return null
  return paging.control
}

/**
 * Whether older pages still exist, whether or not they can be fetched right now.
 *
 * This is the question a capture asks before announcing "loading earlier messages": a control that is
 * busy or waiting to retry means the transcript is still incomplete, while a disabled one carrying the
 * `start` label means there is nothing above the first turn.
 */
export function hasOlderPages(root) {
  const paging = readPaging(root)
  if (paging === null || paging.disabled || paging.state === 'start') return false
  return true
}

/** Resolve once the scrollport stops changing, or the budget runs out. */
export function waitForStableHeight(scroller, timeout) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout
    let previous = scroller.scrollHeight
    let stable = 0
    const tick = () => {
      const current = scroller.scrollHeight
      stable = current === previous ? stable + 1 : 0
      previous = current
      if (stable >= STABLE_TICKS || Date.now() > deadline) {
        resolve(current)
        return
      }
      setTimeout(tick, STABLE_TICK_MS)
    }
    setTimeout(tick, STABLE_TICK_MS)
  })
}

/**
 * Wait for one paging click to take effect: the transcript grows, or the control reports the start of
 * the conversation. The chat view can take several seconds to land a page from the host — far longer
 * than any layout-settling window, so a stability wait alone reads "still loading" as "no more
 * pages".
 * @returns 'grown' | 'exhausted' | 'timeout'
 */
export async function waitForPageEffect(root, scroller, heightBefore, timeout) {
  const deadline = Date.now() + timeout
  for (;;) {
    if (scroller.scrollHeight > heightBefore) return 'grown'
    const paging = readPaging(root)
    if (paging === null || paging.disabled || paging.state === 'start') {
      await waitForStableHeight(scroller, 4000)
      return 'exhausted'
    }
    if (Date.now() > deadline) return 'timeout'
    await new Promise((resolve) => setTimeout(resolve, STABLE_TICK_MS))
  }
}

/** The scroller that owns the transcript, or the anchor itself when the host marks no scroller. */
export function scrollerOf(root) {
  return root.closest(`[${SCROLL_ATTRIBUTE}]`) ?? root
}

/**
 * Pull in every older page so the picture covers the whole loaded session.
 * @returns true when no older page remains and the transcript is fully loaded; false when paging
 *   stopped early.
 */
export async function loadFullHistory(root, onProgress) {
  const scroller = scrollerOf(root)
  const restoreTop = scroller.scrollTop
  const deadline = Date.now() + HISTORY_BUDGET
  let rounds = 0
  try {
    while (Date.now() < deadline) {
      const paging = readPaging(root)
      // Nothing left to fetch: no control, a disabled one, or the control's own "start" label.
      if (paging === null || paging.disabled || paging.state === 'start') return true
      const before = scroller.scrollHeight
      // A page already in flight is not clicked again; the click that started it is being awaited.
      if (paging.state !== 'busy') paging.control.click()
      const effect = await waitForPageEffect(root, scroller, before, PAGE_EFFECT_TIMEOUT)
      if (effect === 'exhausted') return true
      if (effect === 'grown') {
        rounds += 1
        onProgress?.(rounds)
        // Let the prepended page settle before pulling the next one.
        await waitForStableHeight(scroller, 3000)
      }
    }
    return false
  } finally {
    scroller.scrollTop = restoreTop
  }
}
