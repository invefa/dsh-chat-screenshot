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
  EDGE_CHOICES,
  EDGE_PADDING,
  INSERT_MAX_CHARS,
  MAX_RULES,
  RULE_ATTR_CHARS,
  RULE_NAME_CHARS,
  RULE_SELECTOR_CHARS,
  RULE_VALUE_CHARS,
  SCALE_CHOICES,
  STYLE_PROPS,
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

/** The free-text blocks the picture can carry, with the length each one is capped at. */
export const TEXT_FIELDS = [
  ['title', INSERT_MAX_CHARS.title],
  ['subtitle', INSERT_MAX_CHARS.subtitle],
  ['footer', INSERT_MAX_CHARS.footer],
]

/** What a capture shows when the reader has never opened the settings page. */
export const OPTION_DEFAULTS = Object.freeze({
  hideClock: true,
  hideProcess: false,
  hideAttachments: false,
  hideNav: true,
  hideHandles: true,
  hideToBottom: true,
  hidePaging: true,
  hideComposer: true,
  title: '',
  subtitle: '',
  footer: '',
  showMeta: false,
  divider: true,
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
  for (const [field, limit] of TEXT_FIELDS) {
    const value = source[field]
    if (typeof value === 'string') next[field] = value.replace(/\s+/g, ' ').trim().slice(0, limit)
  }
  if (typeof source.showMeta === 'boolean') next.showMeta = source.showMeta
  if (typeof source.divider === 'boolean') next.divider = source.divider
  if (ALIGN_CHOICES.includes(source.align)) next.align = source.align
  if (SCALE_CHOICES.includes(source.scale)) next.scale = source.scale
  next.edge = nearestEdge(source.edge)
  next.rules = normalizeRules(source.rules)
  return next
}

/** Whether the chosen options put anything above or below the transcript. */
export function hasInserts(options) {
  return options.title !== '' || options.subtitle !== '' || options.footer !== '' || options.showMeta
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

/** The options in a component, re-rendered on every change. */
export function useOptions() {
  return react.useSyncExternalStore(subscribeOptions, readOptions, readOptions)
}
