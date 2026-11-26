/**
 * Message tables and the one lookup.
 *
 * Every user-facing string lives here, so both languages say the same thing and no prose hides
 * inside a view. The tables are registered with the host's locale service under this plugin's
 * namespace: the service owns the active language, the fallback chain and the re-render, and the
 * picture's own copy follows a switch without a reload. The bundled `zh` and `en` tables are also
 * the source of `checks/i18n.mjs`, which fails when a key exists in one language only.
 */

import { react } from './runtime.js'
/** Locale namespace owned by this plugin. */
export const NS = 'chat-screenshot'

export const MESSAGES = {
  zh: {
    'action.whole': '对话截图',
    'action.wholeHint': '把整段对话长截图并复制到剪贴板',
    'action.turn': '本轮截图',
    'action.turnHint': '把这一轮问答截图并复制到剪贴板',
    'state.loadingHistory': '正在载入更早的对话…',
    'state.rendering': '正在生成图片…',
    'state.copied': '已复制长截图（{width}×{height}）',
    'state.turnCopied': '已复制本轮截图（{width}×{height}）',
    'state.partialCopy': '已复制截图（仅含已加载的对话轮次）',
    'state.downloaded': '剪贴板不可用，已改为下载 PNG',
    'state.downloadedPartial': '剪贴板不可用，已改为下载 PNG（仅含已加载的轮次）',
    'state.scaled': '内容过长，已按 {scale} 倍缩放以避开画布上限',
    'state.empty': '当前会话还没有可截图的内容',
    'state.turnMissing': '没有找到这一轮的范围，刷新页面后重试',
    'state.failed': '截图失败：{message}',
  },
  en: {
    'action.whole': 'Chat screenshot',
    'action.wholeHint': 'Copy a full-length screenshot of this conversation',
    'action.turn': 'Turn screenshot',
    'action.turnHint': 'Copy a screenshot of this question and its reply',
    'state.loadingHistory': 'Loading earlier messages…',
    'state.rendering': 'Rendering image…',
    'state.copied': 'Long screenshot copied ({width}×{height})',
    'state.turnCopied': 'Turn screenshot copied ({width}×{height})',
    'state.partialCopy': 'Screenshot copied (loaded turns only)',
    'state.downloaded': 'Clipboard unavailable, PNG downloaded instead',
    'state.downloadedPartial': 'Clipboard unavailable, PNG downloaded (loaded turns only)',
    'state.scaled': 'Very long content, scaled to {scale}× to stay within canvas limits',
    'state.empty': 'Nothing to capture in this conversation yet',
    'state.turnMissing': 'Could not resolve this turn, reload the page and try again',
    'state.failed': 'Screenshot failed: {message}',
  },
}

/** Set by `installLocale`; kept as state so a late service still answers. */
let service = null
let bound = null

/**
 * Register the tables with the locale service and keep the bound lookup.
 *
 * @param ctx - client context that owns the locale service.
 * @returns disposer that unregisters both the dictionaries and the local reference.
 */
export function installLocale(ctx) {
  const locale = ctx.locale
  const release = locale.register(NS, MESSAGES)
  service = locale
  bound = locale.bind(NS)
  return () => {
    release()
    if (service === locale) {
      service = null
      bound = null
    }
  }
}

/** Look a key up without the service, for the offline checks and the pre-registration render. */
function fallback(key, vars) {
  const table = MESSAGES.zh
  const raw = table[key] !== undefined ? table[key] : key
  return fill(raw, vars)
}

function fill(raw, vars) {
  if (vars === undefined) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] !== undefined ? String(vars[name]) : match,
  )
}

export function translate(key, vars) {
  if (bound === null) return fallback(key, vars)
  return bound(key, vars)
}

/**
 * Translate in a component and re-render on a language switch.
 *
 * The service bumps a revision on every dictionary registration and every switch, so subscribing to
 * its snapshot is enough; a host without the service keeps the bundled Chinese table.
 */
export function useTranslate() {
  if (service !== null) {
    react.useSyncExternalStore(
      (listener) => service.subscribe(listener),
      () => service.getSnapshot(),
      () => service.getSnapshot(),
    )
  }
  return translate
}
