/**
 * What the picture contains, as the reader chose it, and where that choice is kept.
 *
 * The preference is one small JSON object in the page's own storage. The plugin still declares no
 * host `Config` and no host-side state: nothing has to be registered with the app, no restart is
 * involved, and unloading the plugin leaves one inert key behind. Every read goes through
 * `normalizeOptions`, so a hand-edited or half-written value can only ever select one of the offered
 * presets — the capture never has to defend itself against it.
 */

import { ALIGN_CHOICES, EDGE_CHOICES, EDGE_PADDING, INSERT_MAX_CHARS, SCALE_CHOICES } from './const.js'
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
})

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

/** The options in a component, re-rendered on every change. */
export function useOptions() {
  return react.useSyncExternalStore(subscribeOptions, readOptions, readOptions)
}
