/**
 * Where the picture starts and how tall it is.
 *
 * Pure arithmetic on boxes already measured in the staged clone, kept out of the capture so the
 * edge cases can be tested without a browser. Every cut here trims chrome that sits in the
 * transcript's flow; none of them may take content with it.
 */

/**
 * @param measured - the staged clone's full height.
 * @param scrollerTop - the scroll port's top inside the application surface.
 * @param firstTurnTop - the first turn's top, or `Infinity` when the clone has no turn.
 * @param lastTurnBottom - the last turn's bottom, or 0 when the clone has no turn.
 * @param contentBottom - the lowest visible flow item in the scroll port, or 0 when unmeasured.
 * @returns the band to cut, in the clone's coordinate space.
 */
export function planCrop({
  measured,
  scrollerTop,
  firstTurnTop,
  lastTurnBottom,
  contentBottom = 0,
}) {
  // Start at the first turn rather than the scroll port: cutting above it would slice the previous
  // reply in half.
  const top = Number.isFinite(firstTurnTop)
    ? Math.max(scrollerTop, Math.floor(firstTurnTop))
    : scrollerTop
  // The bottom reaches past the last turn whenever the host lays a card or an attachment strip
  // after it, and stops at the clone itself so a stale marker cannot extend the picture into empty
  // space. Using the live scroll height here instead would clamp a clone that lays out taller back
  // to the page's height and drop its last row.
  const lowest = Math.max(lastTurnBottom, contentBottom)
  const bottom = lowest > 0 ? Math.min(measured, Math.ceil(lowest)) : measured
  const height = Math.max(1, bottom - top)
  return { top, height, bottom }
}
