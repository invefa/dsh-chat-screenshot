/**
 * What the picture contains, as the reader chose it, and where that choice is kept.
 *
 * The preference is one small JSON object in the page's own storage. The plugin still declares no
 * host `Config` and no host-side state: nothing has to be registered with the app, no restart is
 * involved, and unloading the plugin leaves one inert key behind. Every read goes through
 * `normalizeOptions`, so a hand-edited or half-written value can only ever select one of the offered
 * presets — the capture never has to defend itself against it.
 */

import {
  ALIGN_CHOICES,
  BLOCK_KINDS,
  BLOCK_NAME_CHARS,
  BLOCK_TEXT_CHARS,
  BLOCK_ZONES,
  DIVIDER_GAP_MAX,
  DIVIDER_GAP_MIN,
  DIVIDER_THICKNESS_MAX,
  DIVIDER_THICKNESS_MIN,
  EDGE_CHOICES,
  EDGE_PADDING,
  IMAGE_MAX_CHARS,
  IMAGE_WIDTH_MAX,
  IMAGE_WIDTH_MIN,
  MAX_BLOCKS,
  MAX_CUSTOM,
  MAX_RULES,
  RULE_ATTR_CHARS,
  RULE_NAME_CHARS,
  RULE_SELECTOR_CHARS,
  RULE_VALUE_CHARS,
  SCALE_CHOICES,
  SPACER_MAX,
  SPACER_MIN,
  STYLE_PROPS,
  TEXT_SIZES,
} from './const.js'
import { react } from './runtime.js'
/** Storage key owned by this plugin. */
export const STORAGE_KEY = 'chat-screenshot.options'

/**
 * The switches that drop a host subtree from the picture.
 *
 * Every one of them is a piece of the transcript the reader can see on screen, and every one is
 * offered in the edit surface, so nothing is dropped by a rule the reader cannot find: the paging
 * control and the composer used to leave the picture unconditionally, which made two visible parts of
 * the conversation impossible to keep.
 */
export const HIDE_FLAGS = [
  'hideClock',
  'hideProcess',
  'hideAttachments',
  'hideNav',
  'hideHandles',
  'hideToBottom',
  'hidePaging',
  'hideComposer',
]

/** What a capture shows when the reader has never opened the editor. */
export const OPTION_DEFAULTS = Object.freeze({
  hideClock: true,
  hideProcess: false,
  hideAttachments: false,
  hideNav: true,
  hideHandles: true,
  hideToBottom: true,
  hidePaging: true,
  hideComposer: true,
  blocks: [],
  custom: [],
  align: 'left',
  edge: EDGE_PADDING,
  scale: 'auto',
  rules: [],
})

/**
 * A stable id for a rule, derived from its selector.
 *
 * The selector is what a rule is about, so two rules on the same element are one rule: deriving the
 * id keeps a hand-edited store, a repeated click and a reload all pointing at the same entry.
 */
export function ruleId(selector) {
  let hash = 0
  for (let index = 0; index < selector.length; index += 1) {
    hash = (hash * 31 + selector.charCodeAt(index)) | 0
  }
  return `r${(hash >>> 0).toString(36)}`
}

let blockCounter = 0

/** A fresh id for one block. Blocks are placed, reordered and removed, so they cannot key on content. */
export function newBlockId() {
  blockCounter += 1
  return `b${Date.now().toString(36)}${blockCounter.toString(36)}`
}

/** One style map, keeping only the offered properties and only non-empty values. */
function normalizeStyle(raw) {
  const style = {}
  if (raw === null || typeof raw !== 'object') return style
  for (const prop of STYLE_PROPS) {
    const value = raw[prop]
    if (typeof value !== 'string') continue
    const text = value.trim().slice(0, RULE_VALUE_CHARS)
    if (text !== '') style[prop] = text
  }
  return style
}

/** One attribute map: names the DOM accepts, values as text, and `null` meaning "remove it". */
function normalizeAttrs(raw) {
  const attrs = {}
  if (raw === null || typeof raw !== 'object') return attrs
  for (const name of Object.keys(raw).slice(0, MAX_RULES)) {
    if (!/^[a-z][a-z0-9-]*$/i.test(name)) continue
    if (name === 'style' || name === 'class') continue
    const value = raw[name]
    if (value === null) attrs[name] = null
    else if (typeof value === 'string') attrs[name] = value.slice(0, RULE_ATTR_CHARS)
  }
  return attrs
}

/** Clamp one stored rule onto the shape the capture understands, or drop it. */
export function normalizeRule(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const selector = typeof raw.selector === 'string' ? raw.selector.trim().slice(0, RULE_SELECTOR_CHARS) : ''
  if (selector === '') return null
  return {
    id: ruleId(selector),
    selector,
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, RULE_NAME_CHARS) : '',
    hide: raw.hide === true,
    style: normalizeStyle(raw.style),
    attrs: normalizeAttrs(raw.attrs),
  }
}

/** Every stored rule, deduplicated by id and capped. */
export function normalizeRules(raw) {
  if (!Array.isArray(raw)) return []
  // A selector owns one rule: a later duplicate replaces the earlier one in place, which keeps the
  // order the user built while making a hand-edited or half-written array behave predictably.
  const byId = new Map()
  for (const entry of raw) {
    const rule = normalizeRule(entry)
    if (rule === null) continue
    byId.set(rule.id, rule)
  }
  return Array.from(byId.values()).slice(0, MAX_RULES)
}

/** One number inside a range, or the fallback. */
function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/** A zone name, or the fallback. */
function zoneOf(value) {
  return BLOCK_ZONES.includes(value) ? value : 'top'
}

/** A text size, or `body`. */
function sizeOf(value) {
  return TEXT_SIZES.includes(value) ? value : 'body'
}

/** An alignment, or the fallback. */
function alignOf(value, fallback) {
  return ALIGN_CHOICES.includes(value) ? value : fallback
}

/**
 * The content of a block, without the fields its kind does not use.
 *
 * Keeping one shape per kind means the capture, the editor and a saved component all read the same
 * three or four fields, and a hand-edited store cannot smuggle a font size into a divider.
 */
function normalizeContent(kind, raw, align) {
  if (kind === 'text') {
    const text =
      typeof raw.text === 'string'
        ? raw.text
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .slice(0, BLOCK_TEXT_CHARS)
        : ''
    return { text, size: sizeOf(raw.size), align: alignOf(raw.align, align) }
  }
  if (kind === 'spacer') return { height: clampNumber(raw.height, SPACER_MIN, SPACER_MAX, 24) }
  if (kind === 'image') {
    const src = typeof raw.src === 'string' && raw.src.startsWith('data:image/') ? raw.src : ''
    return {
      src: src.length <= IMAGE_MAX_CHARS ? src : '',
      width: clampNumber(raw.width, IMAGE_WIDTH_MIN, IMAGE_WIDTH_MAX, 100),
    }
  }
  if (kind === 'divider') {
    return {
      thickness: clampNumber(raw.thickness, DIVIDER_THICKNESS_MIN, DIVIDER_THICKNESS_MAX, 1),
      gap: clampNumber(raw.gap, DIVIDER_GAP_MIN, DIVIDER_GAP_MAX, 0),
    }
  }
  return {}
}

/** Clamp one stored block onto the shape the capture understands. */
export function normalizeBlock(raw, fallbackAlign = 'left') {
  if (raw === null || typeof raw !== 'object') return null
  // A block whose kind this version does not know is dropped rather than turned into something the
  // user never asked for: an unknown kind is data from a newer version, not a text block.
  if (!BLOCK_KINDS.includes(raw.kind)) return null
  const kind = raw.kind
  const content = normalizeContent(kind, raw, fallbackAlign)
  // An image with no usable bytes would paint an empty box, so it never becomes a block.
  if (kind === 'image' && content.src === '') return null
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id.slice(0, 40) : newBlockId()
  return {
    id,
    kind,
    zone: zoneOf(raw.zone),
    ...content,
  }
}

/** Every stored block, in the order it was placed, capped. */
export function normalizeBlocks(raw, align = 'left') {
  if (!Array.isArray(raw)) return []
  const blocks = []
  for (const entry of raw) {
    const block = normalizeBlock(entry, align)
    if (block === null) continue
    blocks.push(block)
    if (blocks.length >= MAX_BLOCKS) break
  }
  return blocks
}

/** One saved component: a named block shape the palette can drop again. */
export function normalizeCustom(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const source = raw.block !== null && typeof raw.block === 'object' ? raw.block : raw
  const kind = BLOCK_KINDS.includes(source.kind) ? source.kind : 'text'
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, BLOCK_NAME_CHARS) : ''
  if (name === '') return null
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id.slice(0, 40) : newBlockId(),
    name,
    block: { kind, ...normalizeContent(kind, source, 'left') },
  }
}

/** Every saved component, deduplicated by id and capped. */
export function normalizeCustoms(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const list = []
  for (const entry of raw) {
    const custom = normalizeCustom(entry)
    if (custom === null || seen.has(custom.id)) continue
    seen.add(custom.id)
    list.push(custom)
    if (list.length >= MAX_CUSTOM) break
  }
  return list
}

/**
 * The settings of the build before blocks existed, read as blocks.
 *
 * Anyone who had already filled in a title, a subtitle or a footer keeps exactly the picture they
 * had: those three become text blocks in the zone they used to occupy, the divider and the date line
 * become blocks too, and the fields themselves stop being read once `blocks` exists.
 */
function legacyBlocks(source) {
  const align = alignOf(source.align, 'left')
  const text = (value, limit) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''
  const title = text(source.title, 120)
  const subtitle = text(source.subtitle, 160)
  const footer = text(source.footer, 200)
  const blocks = []
  if (title !== '') blocks.push({ kind: 'text', zone: 'top', text: title, size: 'title', align })
  if (subtitle !== '') blocks.push({ kind: 'text', zone: 'top', text: subtitle, size: 'subtitle', align })
  if (source.divider === true) blocks.push({ kind: 'divider', zone: 'top' })
  if (footer !== '') blocks.push({ kind: 'text', zone: 'bottom', text: footer, size: 'body', align })
  if (source.showMeta === true) blocks.push({ kind: 'meta', zone: 'bottom' })
  return blocks
}

/** The nearest offered preset, so a stored value outside the list still lands on a real one. */
function nearestEdge(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return OPTION_DEFAULTS.edge
  return EDGE_CHOICES.reduce((best, choice) =>
    Math.abs(choice - number) < Math.abs(best - number) ? choice : best,
  )
}

/** Clamp one stored value onto the shape the capture understands. */
export function normalizeOptions(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const next = { ...OPTION_DEFAULTS }
  for (const flag of HIDE_FLAGS) {
    if (typeof source[flag] === 'boolean') next[flag] = source[flag]
  }
  next.align = alignOf(source.align, next.align)
  next.scale = SCALE_CHOICES.includes(source.scale) ? source.scale : next.scale
  next.edge = nearestEdge(source.edge)
  next.blocks = normalizeBlocks(Array.isArray(source.blocks) ? source.blocks : legacyBlocks(source), next.align)
  next.custom = normalizeCustoms(source.custom)
  next.rules = normalizeRules(source.rules)
  return next
}

/** Whether the chosen options put anything above or below the transcript. */
export function hasInserts(options) {
  return Array.isArray(options.blocks) && options.blocks.length > 0
}

/** The page's storage, or null when the browser refuses it (private mode, disabled storage). */
function storage() {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

let cached = null
const listeners = new Set()

function readStored() {
  const store = storage()
  if (store === null) return null
  try {
    const text = store.getItem(STORAGE_KEY)
    return text === null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

function persist(options) {
  const store = storage()
  if (store === null) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // A full or read-only storage only costs persistence; the capture uses the in-memory value.
  }
}

function emit() {
  for (const listener of [...listeners]) listener()
}

/** The active options. Identity is stable while nothing changes, which is what React subscribes to. */
export function readOptions() {
  if (cached === null) cached = normalizeOptions(readStored())
  return cached
}

/** Merge one change into the stored options and tell every reader. */
export function writeOptions(patch) {
  cached = normalizeOptions({ ...readOptions(), ...patch })
  persist(cached)
  emit()
  return cached
}

/** Drop the stored object and fall back to the defaults. */
export function resetOptions() {
  const store = storage()
  if (store !== null) {
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      // Same as a refused write: the defaults still apply for this session.
    }
  }
  cached = normalizeOptions(null)
  emit()
  return cached
}

/** Subscribe to changes; hands back the unsubscribe. */
export function subscribeOptions(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The rule that covers one selector, or null when the element carries none. */
export function ruleFor(options, selector) {
  return options.rules.find((rule) => rule.selector === selector) ?? null
}

/**
 * Write one rule, creating it when the selector has none yet.
 *
 * The editor only ever knows an element and a change, so the merge lives here: a patch changes the
 * named fields and leaves the rest of the rule alone, which is what makes "hide this" and "make it
 * smaller" accumulate on the same element instead of replacing each other.
 */
export function saveRule(selector, patch) {
  const current = readOptions()
  const existing = ruleFor(current, selector)
  const draft = {
    selector,
    name: existing === null ? '' : existing.name,
    hide: existing === null ? false : existing.hide,
    style: existing === null ? {} : existing.style,
    attrs: existing === null ? {} : existing.attrs,
    ...patch,
  }
  const saved = normalizeRule(draft)
  if (saved === null) return null
  writeOptions({ rules: [...current.rules.filter((rule) => rule.selector !== selector), saved] })
  return saved
}

/** Drop the rule on one selector, leaving the element as the host draws it. */
export function dropRule(selector) {
  const current = readOptions()
  writeOptions({ rules: current.rules.filter((rule) => rule.selector !== selector) })
}

/** The block with one id, or null. */
export function blockFor(options, id) {
  return options.blocks.find((block) => block.id === id) ?? null
}

/** Insert one block, at an index inside its zone (the end when the index is out of range). */
export function addBlock(zone, block, index = -1) {
  const current = readOptions()
  const stored = normalizeBlock({ ...block, zone: zoneOf(zone) }, current.align)
  if (stored === null) return null
  const blocks = [...current.blocks]
  const bounds = zoneBounds(blocks, stored.zone)
  const at = index < 0 || index > bounds.count ? zoneStart(blocks, stored.zone) + bounds.count : zoneStart(blocks, stored.zone) + index
  blocks.splice(at, 0, stored)
  writeOptions({ blocks })
  return stored
}

/** Change the fields of one block. */
export function updateBlock(id, patch) {
  const current = readOptions()
  const existing = blockFor(current, id)
  if (existing === null) return null
  const saved = normalizeBlock({ ...existing, ...patch, id }, current.align)
  if (saved === null) return null
  writeOptions({ blocks: current.blocks.map((block) => (block.id === id ? saved : block)) })
  return saved
}

/** Remove one block. */
export function removeBlock(id) {
  const current = readOptions()
  writeOptions({ blocks: current.blocks.filter((block) => block.id !== id) })
}

/** The index of the first block of one zone; blocks of a zone are kept contiguous. */
function zoneStart(blocks, zone) {
  const index = blocks.findIndex((block) => block.zone === zone)
  if (index >= 0) return index
  return zone === 'top' ? 0 : blocks.length
}

/** How many blocks one zone holds. */
function zoneBounds(blocks, zone) {
  return { start: zoneStart(blocks, zone), count: blocks.filter((block) => block.zone === zone).length }
}

/**
 * Move one block to another place.
 *
 * Zones stay contiguous, so a block dropped between two blocks of the other zone lands at the edge of
 * the zone it was dropped into rather than splitting the other one.
 */
export function moveBlock(id, zone, index) {
  const current = readOptions()
  const existing = blockFor(current, id)
  if (existing === null) return null
  const rest = current.blocks.filter((block) => block.id !== id)
  const moved = { ...existing, zone: zoneOf(zone) }
  const bounds = zoneBounds(rest, moved.zone)
  const at = Math.min(bounds.start + Math.max(0, index), bounds.start + bounds.count)
  const blocks = [...rest.slice(0, at), moved, ...rest.slice(at)]
  writeOptions({ blocks })
  return moved
}

/**
 * Whether a component can stand in the picture as it is.
 *
 * Every kind can, except an image without bytes: a picture cannot be painted from nothing, so placing
 * one would add an invisible block. The shelf sends that case to the designer instead of dropping a
 * block that draws no pixels.
 */
export function canPlace(block) {
  if (block === null || block === undefined || typeof block !== 'object') return false
  if (!BLOCK_KINDS.includes(block.kind)) return false
  if (block.kind === 'image') return typeof block.src === 'string' && block.src.startsWith('data:image/')
  return true
}

/** Forget one saved component. */
export function dropCustom(id) {
  const current = readOptions()
  writeOptions({ custom: current.custom.filter((entry) => entry.id !== id) })
}

/**
 * Save a component, replacing the entry with the same id when one exists. Returns the stored entry,
 * or null when the name is empty or the block carried nothing.
 */
export function storeCustom(id, name, block) {
  const label = typeof name === 'string' ? name.trim().slice(0, BLOCK_NAME_CHARS) : ''
  if (label === '' || block === null || typeof block !== 'object') return null
  const current = readOptions()
  const custom = normalizeCustom({ id: id ?? undefined, name: label, block })
  if (custom === null) return null
  const kept = current.custom.filter((entry) => entry.id !== custom.id)
  writeOptions({ custom: [custom, ...kept].slice(0, MAX_CUSTOM) })
  return custom
}

/** The options in a component, re-rendered on every change. */
export function useOptions() {
  return react.useSyncExternalStore(subscribeOptions, readOptions, readOptions)
}
