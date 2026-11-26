/**
 * Draining the transcript's history before the picture is taken.
 *
 * Paging is driven from the chat view's own control. A page can take several seconds to land and
 * the host's prepend pipeline can fail one fetch while later ones succeed, so the control is
 * re-clicked every few seconds — the way a person drains the history — until it unmounts. That is
 * also why the result is reported honestly: when the budget runs out the caller says "loaded turns
 * only" instead of claiming a full capture.
 */

import {
  HISTORY_BUDGET,
  LOAD_OLDER_LABELS,
  PAGE_EFFECT_TIMEOUT,
  SCROLL_ATTRIBUTE,
  STABLE_TICKS,
  STABLE_TICK_MS,
} from '../shell/const.js'
/**
 * The paging control, never transcript prose that merely mentions paging: one real control whose
 * own label is essentially the paging wording.
 */
export function findLoadOlder(root) {
  for (const candidate of root.querySelectorAll('button, [role="button"]')) {
    const own = `${candidate.textContent ?? ''} ${candidate.getAttribute('aria-label') ?? ''}`
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    if (own === '' || own.length > 24) continue
    if (LOAD_OLDER_LABELS.some((needle) => own === needle || own.startsWith(needle))) {
      return candidate
    }
  }
  return null
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
 * Wait for one paging click to take effect: the transcript grows or the app unmounts the control to
 * report nothing older. The chat view can take several seconds to land a page from the host — far
 * longer than any layout-settling window, so a stability wait alone reads "still loading" as "no
 * more pages".
 * @returns 'grown' | 'exhausted' | 'timeout'
 */
export async function waitForPageEffect(root, scroller, heightBefore, timeout) {
  const deadline = Date.now() + timeout
  for (;;) {
    if (findLoadOlder(root) === null) {
      await waitForStableHeight(scroller, 4000)
      return 'exhausted'
    }
    if (scroller.scrollHeight > heightBefore) return 'grown'
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
      const control = findLoadOlder(root)
      if (control === null) return true
      const before = scroller.scrollHeight
      control.click()
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
