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
    'state.turnsCopied': '已复制 {turns} 轮截图（{width}×{height}）',
    'menu.whole': '整段对话',
    'menu.last': '最后一轮',
    'menu.pick': '选择轮次…',
    'menu.pickTitle': '选择要截图的轮次',
    'menu.pickHint': '勾选要放进同一张图片的问答轮次，按对话顺序排列。',
    'menu.confirm': '截图所选（{turns}）',
    'menu.cancel': '取消',
    'menu.turn': '第 {index} 轮',
    'insert.meta': '{turns} 轮对话 · {date} {time}',
    'insert.metaSample': '2 轮对话 · 2026-01-01 09:05',
    'settings.title': '对话截图',
    'settings.intro': '下面这张就是截图的样子。点一下某个部件就隐藏它，再点一下放回来；右键打开完整清单，也能在那里加页头和页脚。设置即刻生效，保存在本机。',
    'settings.previewHint': '预览按当前设置绘制。隐藏的部件留一条虚线占位，点一下即可恢复。',
    'settings.piece.nav': '轮次导航',
    'settings.piece.attachments': '用户附件条',
    'settings.piece.process': '思考与工具过程',
    'settings.piece.clock': '时钟与操作行',
    'settings.piece.toBottom': '回到底部按钮',
    'settings.piece.handles': '拖拽手柄与占位',
    'settings.piece.head': '页头',
    'settings.piece.foot': '页脚',
    'settings.piece.meta': '页脚信息行',
    'settings.piece.divider': '分隔线',
    'settings.menu.head': '添加页头',
    'settings.menu.headEdit': '编辑页头',
    'settings.menu.foot': '添加页脚',
    'settings.menu.footEdit': '编辑页脚',
    'settings.sample.nav': '导航',
    'settings.sample.user': '请把这份记录整理成一份说明',
    'settings.sample.files': '附件：方案.md',
    'settings.sample.process': '思考中 · 2 个工具步骤',
    'settings.sample.answer': '已按三段整理，末尾补了结论。',
    'settings.sample.clock': '09:05 · 1.2k tokens',
    'settings.sample.toBottom': '回到底部',
    'settings.sample.handles': '拖拽手柄',
    'settings.edit.title': '标题',
    'settings.edit.subtitle': '副标题',
    'settings.edit.footer': '页脚文字',
    'settings.edit.tokens': '可用 {turns}、{date}、{time} 三个占位符。',
    'settings.edit.untitled': '（未填写标题）',
    'settings.edit.save': '保存',
    'settings.edit.cancel': '取消',
    'settings.add.titlePlaceholder': '例如：会话整理',
    'settings.layout.align': '文字对齐',
    'settings.layout.alignHint': '页头与页脚的对齐方式',
    'settings.align.left': '左对齐',
    'settings.align.center': '居中',
    'settings.layout.edge': '边距',
    'settings.layout.edgeHint': '内容与画布边缘之间的留白',
    'settings.edge.tight': '紧凑',
    'settings.edge.normal': '标准',
    'settings.edge.loose': '宽松',
    'settings.layout.scale': '清晰度',
    'settings.layout.scaleHint': '自动会取画布上限允许的最大倍数；固定倍数不会超过该上限',
    'settings.scale.auto': '自动',
    'settings.scale.x1': '1 倍',
    'settings.scale.x2': '2 倍',
    'settings.scale.x3': '3 倍',
    'settings.reset': '恢复默认',
    'settings.resetHint': '清除已保存的选项并回到默认',
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
    'state.turnsCopied': 'Copied {turns} turns ({width}×{height})',
    'menu.whole': 'Whole conversation',
    'menu.last': 'Last turn',
    'menu.pick': 'Choose turns…',
    'menu.pickTitle': 'Choose the turns to capture',
    'menu.pickHint': 'Tick the exchanges that belong in one picture; they keep their reading order.',
    'menu.confirm': 'Capture {turns} selected',
    'menu.cancel': 'Cancel',
    'menu.turn': 'Turn {index}',
    'insert.meta': 'Turns: {turns} · {date} {time}',
    'insert.metaSample': 'Turns: 2 · 2026-01-01 09:05',
    'settings.title': 'Chat screenshot',
    'settings.intro':
      'Choose which chrome the picture keeps, which text it adds, and how it is laid out. Changes apply to the next capture and are stored on this machine.',
    'settings.intro':
      'The picture below is what a capture makes. Click a piece to drop it, click it again to bring it back, and right-click for the full list, where the header and the footer are added. Changes apply to the next capture and are stored on this machine.',
    'settings.previewHint': 'The preview is drawn from the current settings. A hidden piece leaves a dashed gap; click it to restore.',
    'settings.piece.nav': 'Turn navigator',
    'settings.piece.attachments': 'Attachment strip',
    'settings.piece.process': 'Thinking and tool steps',
    'settings.piece.clock': 'Clock and action row',
    'settings.piece.toBottom': 'Back-to-bottom button',
    'settings.piece.handles': 'Drag handles and spacers',
    'settings.piece.head': 'Header',
    'settings.piece.foot': 'Footer',
    'settings.piece.meta': 'Footer meta line',
    'settings.piece.divider': 'Divider',
    'settings.menu.head': 'Add a header',
    'settings.menu.headEdit': 'Edit the header',
    'settings.menu.foot': 'Add a footer',
    'settings.menu.footEdit': 'Edit the footer',
    'settings.sample.nav': 'Navigator',
    'settings.sample.user': 'Turn this transcript into a short brief',
    'settings.sample.files': 'Attachment: plan.md',
    'settings.sample.process': 'Thinking · 2 tool steps',
    'settings.sample.answer': 'Three sections now, and a conclusion at the end.',
    'settings.sample.clock': '09:05 · 1.2k tokens',
    'settings.sample.toBottom': 'Back to bottom',
    'settings.sample.handles': 'Drag handle',
    'settings.edit.title': 'Title',
    'settings.edit.subtitle': 'Subtitle',
    'settings.edit.footer': 'Footer text',
    'settings.edit.tokens': 'Three placeholders are available: {turns}, {date} and {time}.',
    'settings.edit.untitled': '(no title yet)',
    'settings.edit.save': 'Save',
    'settings.edit.cancel': 'Cancel',
    'settings.add.titlePlaceholder': 'e.g. Session notes',
    'settings.layout.align': 'Text alignment',
    'settings.layout.alignHint': 'Alignment of the added header and footer',
    'settings.align.left': 'Left',
    'settings.align.center': 'Center',
    'settings.layout.edge': 'Margin',
    'settings.layout.edgeHint': 'Space between the content and the canvas edge',
    'settings.edge.tight': 'Tight',
    'settings.edge.normal': 'Normal',
    'settings.edge.loose': 'Wide',
    'settings.layout.scale': 'Resolution',
    'settings.layout.scaleHint':
      'Auto takes the largest factor the canvas budget allows; a fixed factor never exceeds it',
    'settings.scale.auto': 'Auto',
    'settings.scale.x1': '1x',
    'settings.scale.x2': '2x',
    'settings.scale.x3': '3x',
    'settings.reset': 'Reset to defaults',
    'settings.resetHint': 'Forget the saved options and return to the defaults',
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
