/**
 * What leaves the picture, expressed as rules instead of a fixed list.
 *
 * The plugin knows a handful of host markers by name, but a transcript is just a web page: a host
 * release can add a row, and another plugin can paint one, and neither is on any list here. So the
 * switches the reader used to flip are the built-in half of one mechanism, and anything they pick in
 * the copy is the other half. Both are selectors applied to the same staged clone, which is why the
 * edit surface and the capture cannot disagree.
 *
 * Hiding is a declaration, not a deletion: the element stays in the copy with no box. A capture
 * measures the transcript without it, while the edit surface can still point at the hole and put the
 * element back where it was.
 */

import {
  EDITOR_ATTRIBUTE,
  FIELD_ATTRIBUTE,
  HIDE_STYLE,
  PIECE_ATTRIBUTE,
} from '../../shell/const.js'
import { OPTION_DEFAULTS } from '../../shell/options.js'
import { CHROME_PIECES } from './prepare.js'

/** Every element one selector list covers, in document order, without duplicates. */
function collect(root, selectors) {
  const found = []
  for (const selector of selectors) {
    let list
    try {
      list = root.querySelectorAll(selector)
    } catch {
      // A selector the browser refuses matches nothing; it must not abort the whole capture.
      continue
    }
    for (const node of list) {
      if (!found.includes(node)) found.push(node)
    }
  }
  return found
}

/** Apply one declaration map inline. Inline wins over the host's sheet and survives serialization. */
function applyStyle(node, style) {
  for (const prop of Object.keys(style)) node.style.setProperty(prop, style[prop])
}

/**
 * Apply the built-in switches and the reader's rules to a staged copy.
 *
 * @param clone - the staged copy, already sanitized and pruned.
 * @param options - the reader's switches and rules.
 * @returns one entry per rule that matched, each holding the elements it covers, so a surface can
 * list what is hidden and point at it.
 */
export function applyRules(clone, options = OPTION_DEFAULTS) {
  const entries = []
  for (const piece of CHROME_PIECES) {
    const elements = collect(clone, piece.selectors)
    if (elements.length === 0) continue
    const hide = options[piece.option] === true
    for (const node of elements) {
      // The tag stays even when the piece is kept: the crop reads the composer through it.
      node.setAttribute(PIECE_ATTRIBUTE, piece.id)
      if (hide) applyStyle(node, HIDE_STYLE)
    }
    entries.push({ id: piece.id, kind: 'piece', option: piece.option, name: '', hide, elements })
  }
  for (const rule of options.rules ?? []) {
    const elements = collect(clone, [rule.selector])
    if (elements.length === 0) continue
    for (const node of elements) {
      if (rule.hide) applyStyle(node, HIDE_STYLE)
      applyStyle(node, rule.style ?? {})
      for (const name of Object.keys(rule.attrs ?? {})) {
        const value = rule.attrs[name]
        if (value === null) node.removeAttribute(name)
        else node.setAttribute(name, value)
      }
    }
    entries.push({ id: rule.id, kind: 'rule', selector: rule.selector, name: rule.name, hide: rule.hide, elements })
  }
  return { entries }
}

/** Attributes that are ours or already accounted for, and so never name an element. */
const IGNORED_ATTRIBUTES = new Set([PIECE_ATTRIBUTE, FIELD_ATTRIBUTE, EDITOR_ATTRIBUTE])

/** Whether one selector picks out exactly one element under the copy. */
function isUnique(root, selector) {
  try {
    return root.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

/** A marker attribute on one element, if the host put a usable one there. */
function markerOf(node) {
  for (const name of node.getAttributeNames()) {
    if (!name.startsWith('data-')) continue
    if (IGNORED_ATTRIBUTES.has(name)) continue
    return name
  }
  return null
}

/**
 * A selector that picks the same element out of a freshly staged copy.
 *
 * The order is the one a debugger uses: an id, then a host marker, then the classes, then the path
 * from the nearest anchor. The result is a CSS selector rather than a private key, so the reader can
 * read it, edit it, and reuse it on an element this plugin never saw.
 */
export function elementKey(element, root) {
  if (element === root) return ':scope'
  if (typeof element.id === 'string' && element.id !== '') {
    const byId = `#${element.id}`
    if (isUnique(root, byId)) return byId
  }
  const marker = markerOf(element)
  if (marker !== null) {
    const byMarker = `[${marker}]`
    if (isUnique(root, byMarker)) return byMarker
  }
  const tag = element.tagName.toLowerCase()
  const classes = [...element.classList].filter((name) => !name.startsWith('cs-ed'))
  if (classes.length > 0) {
    const byClass = `${tag}${classes.map((name) => `.${name}`).join('')}`
    if (isUnique(root, byClass)) return byClass
  }

  // Nothing names the element on its own, so walk up and stop at the first ancestor whose marker
  // plus the path below it is already unique.
  const steps = []
  let node = element
  while (node !== null && node !== root) {
    const parent = node.parentElement
    const index = parent === null ? 1 : [...parent.children].indexOf(node) + 1
    steps.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`)
    const anchor = markerOf(node)
    if (anchor !== null) {
      const anchored = [`[${anchor}]`, ...steps.slice(1)].join(' > ')
      if (isUnique(root, anchored)) return anchored
    }
    node = parent
  }
  return steps.join(' > ')
}

/** The plain facts about one element, for the inspector. */
export function describeElement(element) {
  const attrs = {}
  for (const name of element.getAttributeNames()) {
    if (IGNORED_ATTRIBUTES.has(name)) continue
    attrs[name] = element.getAttribute(name) ?? ''
  }
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
  return {
    tag: element.tagName.toLowerCase(),
    attrs,
    text: text.length > 60 ? `${text.slice(0, 60)}…` : text,
    children: element.children.length,
  }
}

/**
 * A name the reader can recognise in a list, before they rename it.
 *
 * The host's own words come first when the element carries them: an `aria-label`, then the visible
 * text, then the marker that made it interesting, and only then the tag.
 */
export function autoName(element) {
  const label = element.getAttribute('aria-label')
  if (label !== null && label.trim() !== '') return label.trim()
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text !== '' && text.length <= 24) return text
  const marker = markerOf(element)
  if (marker !== null) return marker.replace(/^data-/, '').replace(/-/g, ' ')
  const tag = element.tagName.toLowerCase()
  const first = [...element.classList].find((name) => !name.startsWith('cs-ed'))
  return first === undefined ? tag : `${tag}.${first}`
}
