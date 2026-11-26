/**
 * Cutting the requested band out of a rendered frame.
 *
 * The padding is what makes the top and bottom margins identical: the picture starts at the first
 * turn, so there is nothing above it to crop into and the inset has to be added on both sides.
 */

/**
 * @param source - the full frame, already at output resolution.
 * @param clip - band in CSS pixels plus the padding in the same unit.
 * @param scale - device factor the frame was rendered at.
 * @param background - colour used for the padding.
 * @returns a new canvas holding the band, or `source` when no context is available.
 */
export function cropCanvas(source, clip, scale, background) {
  const pad = Math.max(0, Math.round((clip.pad ?? 0) * scale))
  const width = Math.max(1, Math.round(clip.width * scale))
  const height = Math.max(1, Math.round(clip.height * scale))
  const target = document.createElement('canvas')
  target.width = width + pad * 2
  target.height = height + pad * 2
  const ctx = target.getContext('2d')
  if (ctx === null) return source
  if (pad > 0) {
    ctx.fillStyle = background ?? '#000'
    ctx.fillRect(0, 0, target.width, target.height)
  }
  ctx.drawImage(
    source,
    Math.round(clip.left * scale),
    Math.round(clip.top * scale),
    width,
    height,
    pad,
    pad,
    width,
    height,
  )
  return target
}
