/**
 * The SVG renderer: the staged clone goes back to the browser.
 *
 * The hand painter has to model everything it draws, so it loses shadows, gradients,
 * pseudo-elements and sprite icons. This path instead serializes the clone into one standalone SVG
 * document inside a `foreignObject` and lets the engine that laid the app out rasterize it, so the
 * picture matches the screen by construction.
 */

import { SVG_TIMEOUT } from '../shell/const.js'
import { cropCanvas } from './crop.js'
/** Escape text for an XML text node or a double-quoted attribute value. */
export function xmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Rules the SVG document needs for itself.
 *
 * The stage's own guard stylesheet is not part of the serialized clone, so the motion part has to
 * be restated here: an animation that restarts inside the document would be caught mid-flight.
 * Scrollbars are deliberately not touched, because a wide table keeps its own track on screen.
 */
export const SVG_RESET_CSS =
  '*,*::before,*::after{animation:none !important;transition:none !important;' +
  'scroll-behavior:auto !important;}\n';

/**
 * A sheet's parsed rules, for a sheet whose own text could not be read.
 *
 * This is the fallback, not the default: `cssRules[i].cssText` is a serialization of what the engine
 * understood, and a shorthand whose value came from a custom property collapses there into empty
 * longhands (`font: var(--a)` arrives as `font-size: ;`, `line-height: ;` and so on). A sheet built
 * that way loses the type metrics the screen actually uses.
 */
function serializeSheet(sheet) {
  const parts = []
  const read = (value) => {
    try {
      return value.cssRules
    } catch {
      return null
    }
  }
  /**
   * `carry` is false inside a grouping rule: its own `cssText` already stands for the whole block,
   * so pushing the inner rules again would double the sheet.
   */
  const walk = (rules, carry) => {
    if (rules === null) return
    for (const rule of rules) {
      if (rule.type === 3 && rule.styleSheet !== null) {
        walk(read(rule.styleSheet), true)
        continue
      }
      if (typeof rule.cssText !== 'string' || rule.cssText === '') continue
      if (typeof rule.selectorText === 'string') {
        if (carry) parts.push(rule.cssText)
        continue
      }
      if (carry) parts.push(rule.cssText)
      const nested = rule.cssRules
      if (nested !== undefined && nested !== null) walk(nested, false)
    }
  }
  walk(read(sheet), true)
  return parts.join('\n')
}

/** A sheet's own text, or null when the element behind it is not readable. */
async function sourceText(owner) {
  if (owner.tagName === 'STYLE') return owner.textContent ?? ''
  if (owner.tagName === 'LINK' && owner.getAttribute('href') !== null) {
    try {
      const response = await fetch(owner.href, { credentials: 'same-origin' })
      if (response.ok) return await response.text()
    } catch {
      return null
    }
  }
  return null
}

/** Apply a `media` attribute to sheet text, the way a `<style media>` element would. */
export function wrapMedia(text, media) {
  if (media === null || media === undefined || media === '' || media === 'all') return text
  return `@media ${media}{${text}}`
}

/**
 * Every stylesheet the document will let us read, in cascade order.
 *
 * The text is taken from the source element rather than from the parsed rules, because the parsed
 * form has already lost every shorthand that was written as a `var()`: the app sets its markdown
 * type scale that way (`font: var(--dsw-font-markdown-code)`, which is size, line height and family
 * in one declaration), and a sheet harvested from `cssRules` renders inline code with the inherited
 * line height instead, so the pill comes out several pixels taller than on screen. Reading
 * `<style>` text and fetching `<link>` files keeps the original declarations.
 *
 * `@import` inside that text is left alone: this document is loaded from a data URL, so a relative
 * import resolves against nothing. The app does not use any, and a sheet that does still contributes
 * everything else.
 */
export async function collectStyleSheet(doc) {
  const sheets = [...doc.styleSheets]
  const texts = new Array(sheets.length).fill('')
  const jobs = []
  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index]
    const owner = sheet.ownerNode
    if (owner === null || owner === undefined) {
      texts[index] = serializeSheet(sheet)
      continue
    }
    jobs.push(
      (async () => {
        const text = await sourceText(owner)
        // An element can carry a sheet it did not write: one built through `replaceSync` has its
        // rules in the sheet and an empty `<style>` behind it, so the parsed form is all there is.
        texts[index] = text === null || text === '' ? serializeSheet(sheet) : wrapMedia(text, owner.getAttribute('media'))
      })(),
    )
  }
  await Promise.all(jobs)
  return texts.filter((text) => text !== '').join('\n')
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Turn media the SVG document cannot fetch into data URLs.
 *
 * An SVG image is loaded as its own document: relative, blob: and authenticated URLs inside it do
 * not resolve the way they do on the page, and a failed subresource either disappears or taints the
 * canvas. Data URLs always work, so every picture is inlined here; one that cannot be read is
 * dropped rather than left as a hole.
 */
export async function inlineMedia(root) {
  const jobs = []
  for (const image of root.querySelectorAll('img')) {
    jobs.push(
      (async () => {
        const src = image.getAttribute('src') ?? ''
        if (src.startsWith('data:')) return
        if (src === '') {
          image.remove()
          return
        }
        try {
          const response = await fetch(src, { credentials: 'include' })
          if (!response.ok) throw new Error(String(response.status))
          image.setAttribute('src', await blobToDataUrl(await response.blob()))
          image.removeAttribute('srcset')
          image.removeAttribute('sizes')
          image.removeAttribute('loading')
        } catch {
          image.remove()
        }
      })(),
    )
  }
  for (const source of root.querySelectorAll('canvas')) {
    try {
      const replacement = root.ownerDocument.createElement('img')
      replacement.setAttribute('src', source.toDataURL('image/png'))
      replacement.setAttribute(
        'style',
        `${source.getAttribute('style') ?? ''};width:${source.clientWidth}px;` +
          `height:${source.clientHeight}px`,
      )
      source.replaceWith(replacement)
    } catch {
      source.remove()
    }
  }
  for (const field of root.querySelectorAll('input, textarea, select')) {
    if (field.tagName === 'SELECT') {
      for (const option of field.options) {
        if (option.selected) option.setAttribute('selected', '')
        else option.removeAttribute('selected')
      }
      continue
    }
    if (field.tagName === 'TEXTAREA') field.textContent = field.value
    else field.setAttribute('value', field.value)
    if (field.checked) field.setAttribute('checked', '')
    else field.removeAttribute('checked')
  }
  await Promise.all(jobs)
}

/** One element's attributes as XML attribute text. */
export function attributeText(element, skipStyle) {
  const parts = []
  for (const attribute of element.attributes) {
    if (skipStyle === true && attribute.name === 'style') continue
    parts.push(`${attribute.name}="${xmlText(attribute.value)}"`)
  }
  return parts.join(' ')
}

/**
 * The custom properties written inline on `<body>`, as declarations.
 *
 * The theme writes the reader's own font lists there, and the body's other inline styles describe
 * the live page frame, which the capture replaces. Carrying only the `--*` declarations keeps the
 * reader's fonts without dragging the page layout into the picture.
 */
export function bodyVariables(body) {
  if (body === null || body === undefined) return ''
  const parts = []
  const style = body.style
  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index)
    if (name.startsWith('--')) parts.push(`${name}:${style.getPropertyValue(name)};`)
  }
  return parts.join('')
}

/**
 * One standalone SVG document holding the clone inside a `foreignObject`.
 *
 * The clone goes back under real `<html>` and `<body>` elements, carrying their attributes: this app
 * hangs its whole theme off selectors such as `html[data-theme]`, and those rules match nothing
 * inside a bare `<div>`, so every `var(--dsw-*)` would fall back to its initial value and the
 * picture would come out in a different type scale and colour set than the screen. Restoring the
 * document spine keeps the cascade intact.
 *
 * The viewport is the capture size, so the browser rasterizes text at the output resolution instead
 * of scaling a smaller render up.
 */
export function buildSvgDocument(html, styleText, doc, { width, height, background, scale }) {
  const pixelWidth = Math.max(1, Math.round(width * scale))
  const pixelHeight = Math.max(1, Math.round(height * scale))
  const rootAttributes = attributeText(doc.documentElement, false)
  const bodyAttributes = attributeText(doc.body, true)
  // `html` is the cloned app subtree, so the mount point is already the top of the fragment: the
  // document spine above it (`<html>`, `<body>`) is enough to keep `html[data-theme]` and body rules
  // matching.
  const frame =
    bodyVariables(doc.body) +
    `margin:0;padding:0;overflow:hidden;width:${width}px;height:${height}px;` +
    `background-color:${background};`
  const sheet = SVG_RESET_CSS + styleText
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<html xmlns="http://www.w3.org/1999/xhtml" ${rootAttributes}>` +
    `<head><style>${xmlText(sheet)}</style></head>` +
    `<body ${bodyAttributes} style="${xmlText(frame)}">` +
    html +
    '</body></html>' +
    '</foreignObject></svg>'
  )
}

/**
 * Decode one SVG document and cut the requested band out of it.
 *
 * A blob URL taints the canvas in Chromium even when the SVG carries nothing external; a data URL
 * does not, which is the only reason the document is loaded that way.
 */
export async function rasterizeSvgDocument(source, { width, height, scale, clip, background }) {
  const url = await blobToDataUrl(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
  const image = new Image()
  const decoded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('svg render timed out')), SVG_TIMEOUT)
    image.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    image.onerror = () => {
      clearTimeout(timer)
      reject(new Error('svg render failed'))
    }
  })
  image.src = url
  await decoded
  const frame = document.createElement('canvas')
  frame.width = Math.max(1, Math.round(width * scale))
  frame.height = Math.max(1, Math.round(height * scale))
  const ctx = frame.getContext('2d')
  if (ctx === null) throw new Error('canvas is unavailable')
  ctx.drawImage(image, 0, 0, frame.width, frame.height)
  const canvas = clip === undefined ? frame : cropCanvas(frame, clip, scale, background)
  const blob = await new Promise((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (blob === null) throw new Error('PNG encoding failed')
  return { blob, width: canvas.width, height: canvas.height, scale }
}
