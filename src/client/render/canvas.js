/**
 * The hand painter: the fallback renderer.
 *
 * It rebuilds the clone from the browser's own layout — boxes from `getBoundingClientRect`, each
 * text node's exact line boxes from `Range.getClientRects` — and paints that onto one canvas. It
 * comes second on purpose: it models backgrounds, borders, text, images and inline icons, so
 * shadows, gradients, pseudo-elements and sprite icons are missing from its picture. The SVG
 * renderer (`render/svg.js`) hands the clone back to the browser and matches the screen by
 * construction; this one is what still works when that document cannot be decoded.
 */

import {
  ICON_MAX_EDGE,
  ICON_MAX_SOURCE,
  ICON_TIMEOUT,
  IMAGE_TIMEOUT,
} from '../shell/const.js'
import { cropCanvas } from './crop.js'
import { nextFrame, pushClip, roundedPath, waitForImages } from './scale.js'
/**
 * Split one text node into the lines the browser actually laid out, using a caret rect per code
 * point. Painting these runs at the browser's own pen positions keeps every break point exact:
 * re-fitting lines with `measureText` drifts by a character on long nodes and drops the tail.
 */
export function collectTextLines(node, origin) {
  const lines = []
  let current = null
  let offset = 0
  const range = document.createRange()
  for (const part of node.nodeValue) {
    const start = offset
    offset += part.length
    range.setStart(node, start)
    range.setEnd(node, offset)
    const rects = range.getClientRects()
    if (rects.length === 0) continue
    const rect = rects[0]
    if (Math.abs(rect.top - (current === null ? -Infinity : current.rawTop)) <= 2) {
      current.text += part
      if (rect.bottom - origin.top > current.bottom) current.bottom = rect.bottom - origin.top
      continue
    }
    // A zero-width box that does not continue the current line is a collapsed space at a wrap
    // boundary. A zero-width non-space that does continue it shares a glyph with the previous part
    // (ligature, emoji sequence) and must still reach the painted text.
    if (rect.width === 0 || rect.height === 0) {
      if (current !== null && !/\s/u.test(part)) current.text += part
      continue
    }
    current = {
      rawTop: rect.top,
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      bottom: rect.bottom - origin.top,
      height: rect.height,
      text: part,
    }
    lines.push(current)
  }
  return lines
}

/**
 * Per-side border geometry. Reading only `border-top` loses collapsed table rules: a cell that
 * only owns a bottom rule reported no border at all, so the painted table came out without lines.
 */
export function readBorders(style) {
  const read = (side) => ({
    width: parseFloat(style[`border${side}Width`]) || 0,
    color: style[`border${side}Color`],
    style: style[`border${side}Style`],
  })
  const edges = {
    top: read('Top'),
    right: read('Right'),
    bottom: read('Bottom'),
    left: read('Left'),
  }
  for (const edge of Object.values(edges)) {
    edge.visible =
      edge.width > 0 &&
      edge.style !== 'none' &&
      edge.style !== 'hidden' &&
      edge.style !== 'dashed' &&
      edge.style !== 'dotted'
  }
  return edges
}

/**
 * Walk the staged clone once, collecting boxes, text lines, images and inline SVG icons.
 * `groupOpacity` accumulates the `opacity` of every ancestor, so hover-hidden rows composite to
 * zero and are skipped.
 */
export function collectScene(root, origin) {
  const boxes = []
  const texts = []
  const images = []
  const icons = []

  const collect = (node, clip, groupOpacity) => {
    if (node.nodeType === 3) {
      const value = node.nodeValue
      if (value === null || value.trim() === '') return
      const parent = node.parentElement
      if (parent === null) return
      if (parent instanceof SVGElement) return
      const style = getComputedStyle(parent)
      if (style.visibility !== 'visible') return
      const lines = collectTextLines(node, origin)
      if (lines.length === 0) return
      texts.push({
        lines,
        clip,
        font: style.font,
        color: style.color,
        letterSpacing: style.letterSpacing,
        direction: style.direction,
        opacity: groupOpacity,
      })
      return
    }
    if (node.nodeType !== 1) return
    const element = node
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility !== 'visible') return
    if (style.contentVisibility === 'hidden') return
    const ownOpacity = style.opacity === '' ? 1 : Number(style.opacity)
    const opacity =
      groupOpacity * (Number.isFinite(ownOpacity) ? Math.max(0, Math.min(1, ownOpacity)) : 1)
    const rect = element.getBoundingClientRect()
    const x = rect.left - origin.left
    const y = rect.top - origin.top
    const width = rect.width
    const height = rect.height
    let nextClip = clip
    if (width > 0 && height > 0) {
      const background = style.backgroundColor
      const radius = parseFloat(style.borderTopLeftRadius) || 0
      const borders = readBorders(style)
      const hasBorder =
        borders.top.visible ||
        borders.right.visible ||
        borders.bottom.visible ||
        borders.left.visible
      if (
        (background !== '' && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') ||
        hasBorder ||
        radius > 0
      ) {
        boxes.push({
          x,
          y,
          width,
          height,
          background: background === 'rgba(0, 0, 0, 0)' ? null : background,
          radius,
          borders: hasBorder ? borders : null,
          clip,
          opacity,
        })
      }
      if (
        style.overflowX === 'hidden' ||
        style.overflowX === 'clip' ||
        style.overflowY === 'hidden' ||
        style.overflowY === 'clip'
      ) {
        nextClip = { x, y, w: width, h: height }
      }
    }
    if (element.tagName === 'IMG' && width > 0 && height > 0) {
      images.push({
        element,
        x,
        y,
        width,
        height,
        radius: parseFloat(style.borderTopLeftRadius) || 0,
        clip: nextClip,
        opacity,
      })
    }
    if (
      element instanceof SVGSVGElement &&
      element.ownerSVGElement === null &&
      width > 0 &&
      height > 0 &&
      opacity > 0
    ) {
      icons.push({ element, x, y, width, height, color: style.color, clip: nextClip, opacity })
    }
    for (const child of node.childNodes) collect(child, nextClip, opacity)
  }

  collect(root, null, 1)
  return { boxes, texts, images, icons }
}

/** Draw the four edges of one box, honouring each side's own width and colour. */
export function paintBorder(ctx, box) {
  const { top, right, bottom, left } = box.borders
  const radius = box.radius
  // A rounded box with one uniform rule keeps the rounded stroke; anything else (tables, cells with
  // a single rule) is painted edge by edge.
  const uniform =
    radius > 0 &&
    top.visible &&
    right.visible &&
    bottom.visible &&
    left.visible &&
    top.width === right.width &&
    right.width === bottom.width &&
    bottom.width === left.width &&
    top.color === right.color &&
    right.color === bottom.color &&
    bottom.color === left.color
  if (uniform) {
    ctx.strokeStyle = top.color
    ctx.lineWidth = top.width
    roundedPath(
      ctx,
      box.x + top.width / 2,
      box.y + top.width / 2,
      box.width - top.width,
      box.height - top.width,
      Math.max(0, radius - top.width / 2),
    )
    ctx.stroke()
    return
  }
  const innerTop = top.visible ? top.width : 0
  const innerBottom = bottom.visible ? bottom.width : 0
  const innerHeight = Math.max(0, box.height - innerTop - innerBottom)
  if (top.visible) {
    ctx.fillStyle = top.color
    ctx.fillRect(box.x, box.y, box.width, Math.min(top.width, box.height))
  }
  if (bottom.visible) {
    ctx.fillStyle = bottom.color
    ctx.fillRect(
      box.x,
      box.y + box.height - bottom.width,
      box.width,
      Math.min(bottom.width, box.height),
    )
  }
  if (left.visible) {
    ctx.fillStyle = left.color
    ctx.fillRect(box.x, box.y + innerTop, Math.min(left.width, box.width), innerHeight)
  }
  if (right.visible) {
    ctx.fillStyle = right.color
    ctx.fillRect(
      box.x + box.width - right.width,
      box.y + innerTop,
      Math.min(right.width, box.width),
      innerHeight,
    )
  }
}

/**
 * Paint backgrounds first and every border afterwards, so a cell's fill cannot cover the rule it
 * shares with its neighbour.
 */
export function paintBoxes(ctx, boxes, limit) {
  for (const box of boxes) {
    if (box.y > limit) continue
    const clipped = pushClip(ctx, box.clip)
    ctx.globalAlpha = box.opacity > 0 ? Math.min(1, box.opacity) : 1
    if (box.background !== null) {
      ctx.fillStyle = box.background
      roundedPath(ctx, box.x, box.y, box.width, box.height, box.radius)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (clipped) ctx.restore()
  }
  for (const box of boxes) {
    if (box.borders === null || box.y > limit) continue
    const clipped = pushClip(ctx, box.clip)
    ctx.globalAlpha = box.opacity > 0 ? Math.min(1, box.opacity) : 1
    paintBorder(ctx, box)
    ctx.globalAlpha = 1
    if (clipped) ctx.restore()
  }
}

export function paintTexts(ctx, texts, limit) {
  ctx.textBaseline = 'alphabetic'
  for (const item of texts) {
    if (item.lines.length === 0 || item.lines[0].top > limit) continue
    const clipped = pushClip(ctx, item.clip)
    ctx.font = item.font
    if (item.letterSpacing !== 'normal' && 'letterSpacing' in ctx) {
      ctx.letterSpacing = item.letterSpacing
    }
    if (item.direction === 'rtl' && 'direction' in ctx) ctx.direction = 'rtl'
    ctx.fillStyle = item.color === 'rgba(0, 0, 0, 0)' ? 'transparent' : item.color
    ctx.globalAlpha = item.opacity > 0 ? Math.min(1, item.opacity) : 1
    for (const line of item.lines) {
      if (line.top > limit) continue
      if (line.text.trim() !== '') {
        ctx.fillText(line.text, line.left, line.bottom - Math.max(1, line.height * 0.22))
      }
    }
    ctx.globalAlpha = 1
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    if ('direction' in ctx) ctx.direction = 'ltr'
    if (clipped) ctx.restore()
  }
}

export function paintImages(ctx, images, limit) {
  for (const image of images) {
    if (image.y > limit) continue
    try {
      const clipped = pushClip(ctx, image.clip)
      const rounded = image.radius > 0
      if (rounded) {
        ctx.save()
        roundedPath(ctx, image.x, image.y, image.width, image.height, image.radius)
        ctx.clip()
      }
      ctx.globalAlpha = image.opacity > 0 ? Math.min(1, image.opacity) : 1
      ctx.drawImage(image.element, image.x, image.y, image.width, image.height)
      ctx.globalAlpha = 1
      if (rounded) ctx.restore()
      if (clipped) ctx.restore()
    } catch {
      /* an undecodable image simply stays blank */
    }
  }
}

/**
 * Inline SVG icons become standalone images: serialized with the resolved text colour baked in (an
 * isolated SVG cannot see page CSS, so `currentColor` would fall back to black), then decoded from a
 * data URL. Identical shapes share one decode. Shapes that reference outside themselves — sprite
 * `<use>` targets, `foreignObject`, anything oversized — stay unpainted rather than hang or taint
 * the capture.
 */
export async function rasterizeIcons(icons) {
  const cache = new Map()
  const jobs = icons.map((icon) => {
    if (icon.width > ICON_MAX_EDGE || icon.height > ICON_MAX_EDGE) return null
    let source
    try {
      const clone = icon.element.cloneNode(true)
      clone.removeAttribute('class')
      if (clone.querySelector('use, foreignObject') !== null) return null
      clone.setAttribute('width', String(Math.max(1, Math.round(icon.width))))
      clone.setAttribute('height', String(Math.max(1, Math.round(icon.height))))
      clone.style.setProperty('color', icon.color)
      source = new XMLSerializer().serializeToString(clone)
    } catch {
      return null
    }
    if (source.length > ICON_MAX_SOURCE) return null
    let bitmap = cache.get(source)
    if (bitmap === undefined) {
      bitmap = new Promise((resolve) => {
        const image = new Image()
        const timer = setTimeout(() => resolve(null), ICON_TIMEOUT)
        image.onload = () => {
          clearTimeout(timer)
          resolve(image)
        }
        image.onerror = () => {
          clearTimeout(timer)
          resolve(null)
        }
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source)
      })
      cache.set(source, bitmap)
    }
    return bitmap
  })
  return Promise.all(jobs)
}

export function paintIcons(ctx, icons, bitmaps, limit) {
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    const bitmap = bitmaps[index]
    if (bitmap === null || bitmap === undefined || icon.y > limit) continue
    const clipped = pushClip(ctx, icon.clip)
    ctx.globalAlpha = icon.opacity > 0 ? Math.min(1, icon.opacity) : 1
    ctx.drawImage(bitmap, icon.x, icon.y, icon.width, icon.height)
    ctx.globalAlpha = 1
    if (clipped) ctx.restore()
  }
}

/**
 * Paint a staged clone into a PNG.
 * @returns the blob plus its pixel dimensions.
 */
export async function paintStage(stage, clone, { width, height, background, scale, clip }) {
  await waitForImages(clone, IMAGE_TIMEOUT)
  await nextFrame()
  await nextFrame()

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('canvas is unavailable')

  const origin = stage.getBoundingClientRect()
  const scene = collectScene(clone, origin)
  const iconBitmaps = await rasterizeIcons(scene.icons)
  ctx.save()
  ctx.scale(scale, scale)
  // Start from the resolved page background so translucent layers composite onto the same colour
  // the user sees.
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  paintBoxes(ctx, scene.boxes, height)
  paintTexts(ctx, scene.texts, height)
  paintImages(ctx, scene.images, height)
  paintIcons(ctx, scene.icons, iconBitmaps, height)
  ctx.restore()

  const painted = clip === undefined ? canvas : cropCanvas(canvas, clip, scale, background)
  const blob = await new Promise((resolve) => painted.toBlob((value) => resolve(value), 'image/png'))
  if (blob === null) throw new Error('PNG encoding failed')
  return {
    blob,
    width: painted.width,
    height: painted.height,
    scale,
    elements: scene.boxes.length + scene.texts.length + scene.images.length + scene.icons.length,
  }
}
