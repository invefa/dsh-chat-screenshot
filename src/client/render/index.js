/**
 * Renderer choice: the SVG document first, the hand painter only when it cannot be produced or
 * decoded. One entry point, so the capture never has to know which one drew the picture.
 */

import { IMAGE_TIMEOUT } from '../shell/const.js'
import { paintStage } from './canvas.js'
import { buildSvgDocument, collectStyleSheet, inlineMedia, rasterizeSvgDocument } from './svg.js'
import { nextFrame, waitForImages } from './scale.js'

/**
 * @returns the blob, its pixel size, and which renderer produced it.
 */
export async function renderStage(stage, clone, options) {
  await waitForImages(clone, IMAGE_TIMEOUT)
  await nextFrame()
  try {
    await inlineMedia(clone)
    // Inlining rewrites every source, and a fresh data URL decodes asynchronously; serializing
    // before the decode settles gives the SVG document a picture that has no height yet.
    await waitForImages(clone, IMAGE_TIMEOUT)
    await nextFrame()
    // The sheet is read from the source elements, not from their parsed rules: a shorthand written
    // as a `var()` survives there, and the app builds its markdown type scale that way.
    const sheet = await collectStyleSheet(clone.ownerDocument)
    const html = new XMLSerializer().serializeToString(clone)
    const source = buildSvgDocument(html, sheet, clone.ownerDocument, options)
    const shot = await rasterizeSvgDocument(source, options)
    return { ...shot, mode: 'svg' }
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[dsh-screenshot] svg renderer unavailable, painting instead:', error)
    }
  }
  const shot = await paintStage(stage, clone, options)
  return { ...shot, mode: 'canvas' }
}
