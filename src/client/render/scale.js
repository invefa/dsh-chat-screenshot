/**
 * Canvas budget, timing and the small drawing primitives both renderers use.
 */

import { DEFAULT_SCALE, MAX_AREA, MAX_SIDE, MIN_SCALE } from '../shell/const.js'
/**
 * Scale that keeps the canvas inside browser texture limits.
 *
 * The picture is drawn at 2x unless the budget forces a smaller factor, because a 1x capture reads
 * soft the moment the PNG is opened at its natural size.
 */
export function captureScale(width, height) {
  let scale = DEFAULT_SCALE
  if (width * height * scale * scale > MAX_AREA) {
    scale = Math.max(MIN_SCALE, Math.sqrt(MAX_AREA / (width * height)))
  }
  if (width * scale > MAX_SIDE) scale = MAX_SIDE / width
  if (height * scale > MAX_SIDE) scale = Math.min(scale, MAX_SIDE / height)
  return scale
}

/** Wait for one paint, but never depend on a throttled animation frame. */
export function nextFrame() {
  return Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => resolve())),
    new Promise((resolve) => setTimeout(resolve, 250)),
  ])
}

/** Wait for the clone's images to decode, or for the timeout to run out. */
export function waitForImages(root, timeout) {
  const pending = [...root.querySelectorAll('img')].filter((image) => !image.complete)
  if (pending.length === 0) return Promise.resolve()
  return Promise.race([
    Promise.all(
      pending.map(
        (image) =>
          new Promise((resolve) => {
            const done = () => resolve()
            image.addEventListener('load', done, { once: true })
            image.addEventListener('error', done, { once: true })
          }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ])
}

/** Begin a rounded rectangle path, falling back to a plain one where `roundRect` is missing. */
export function roundedPath(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  const r = Math.min(radius, width / 2, height / 2)
  if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, r)
  else ctx.rect(x, y, width, height)
}

/** Clip to one rect; returns whether a clip was pushed, so the caller knows to restore. */
export function pushClip(ctx, clip) {
  if (clip === null) return false
  ctx.save()
  ctx.beginPath()
  ctx.rect(clip.x, clip.y, clip.w, clip.h)
  ctx.clip()
  return true
}
