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
    'menu.layout': '调整截图内容…',
    'insert.meta': '{turns} 轮对话 · {date} {time}',
    'settings.title': '对话截图',
    'settings.intro': '在这里直接把截图调成想要的样子。点部件隐藏它，再点放回来；页头和页脚就在它们出现的位置写。改动立刻生效，并保存在本机。',
    'settings.editor.open': '在对话中调整…',
  'settings.editor.noConversation': '先打开一个会话，再回来调整。',
  'settings.editor.hint': '双击画面里的任意元素即可隐藏，被隐藏的条目列在下方：单击定位，双击还原；画面下方的托盘可以增删内容块、改名和改样式。',
  'settings.editor.pick': '选取元素',
  'settings.editor.done': '完成',
  'settings.editor.hide': '隐藏',
  'settings.editor.restore': '还原',
  'settings.editor.removeRule': '删除这个元素的规则',
  'settings.editor.hidden': '已隐藏',
  'settings.editor.hiddenEmpty': '没有隐藏的元素。双击画面里的元素就能隐藏它。',
  'settings.editor.hiddenHint': '单击定位，双击还原',
  'settings.editor.side.none': '点画面里的任意元素，查看它的标签、选择器和样式。',
  'settings.editor.side.hide': '隐藏',
  'settings.editor.side.name': '名称',
  'settings.editor.side.attrName': '属性名',
  'settings.editor.side.style': '样式',
  'settings.editor.side.attrs': '属性',
  'settings.editor.side.value': '值',
  'settings.editor.side.add': '添加',
  'settings.editor.side.remove': '移除',
  'settings.editor.side.ruleNote': '改动按元素的选择器保存，截图时对同结构的元素生效。',
  'settings.editor.preset.dim': '淡化',
  'settings.editor.preset.mark': '描边',
  'settings.editor.preset.tight': '去留白',
  'settings.editor.preset.plain': '去底色',
  'settings.editor.preset.mono': '等宽字体',
  'settings.editor.preset.small': '小字号',
  'settings.editor.library': '组件库',
  'settings.editor.tokensHint': '插入变量',
  'settings.editor.zone.top': '页头',
  'settings.editor.zone.bottom': '页脚',
  'settings.editor.align.left': '左对齐',
  'settings.editor.align.center': '居中',
  'settings.editor.block.text': '文本',
  'settings.editor.block.textHint': '写点什么，{turns} 这样的变量会换成真实内容',
  'settings.editor.block.size': '字号',
  'settings.editor.block.align': '对齐',
  'settings.editor.block.height': '高度',
  'settings.editor.block.width': '宽度',
  'settings.editor.block.image': '图片',
  'settings.editor.block.imagePick': '选择图片',
  'settings.editor.block.imageChange': '换一张',
  'settings.editor.block.imageHint': '拖动放置，或从面板选择图片',
  'settings.editor.block.save': '存为组件',
  'settings.editor.block.saveName': '组件名',
  'settings.editor.block.delete': '删除',
  'settings.editor.block.toTop': '移到页头',
  'settings.editor.block.toBottom': '移到页脚',
  'settings.editor.block.dropCustom': '存为自定义组件',
  'settings.editor.block.customFull': '自定义组件已满。',
  'settings.editor.block.zoneHint': '把内容块拖到这里可以调顺序',
  'settings.editor.block.dragHint': '拖进画面即可放置',
  'settings.editor.block.divider': '分隔线',
  'settings.editor.block.spacer': '间隙',
  'settings.editor.block.meta': '信息行',
  'settings.editor.block.sizeTitle': '标题',
  'settings.editor.block.sizeSubtitle': '副标题',
  'settings.editor.block.sizeBody': '正文',
  'settings.piece.nav': '轮次导航',
  'settings.piece.attachments': '用户附件条',
  'settings.piece.process': '思考与工具过程',
  'settings.piece.clock': '时钟与操作行',
  'settings.piece.toBottom': '回到底部按钮',
  'settings.piece.handles': '拖拽手柄与占位',
  'settings.piece.paging': '加载更早的控件',
  'settings.piece.composer': '输入区',

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
    'menu.layout': 'Adjust the shot…',
    'insert.meta': 'Turns: {turns} · {date} {time}',
    'settings.title': 'Chat screenshot',
    'settings.intro': 'Shape the capture right here. Click a piece to drop it, click it again to bring it back, and write the header and footer where they appear. Changes apply at once and are stored on this machine.',
    'settings.editor.open': 'Adjust in the conversation…',
  'settings.editor.noConversation': 'Open a conversation first, then come back.',
  'settings.editor.hint': 'Double-click any element to hide it. Hidden entries sit in the list below: click to locate, double-click to restore. The tray under the picture adds content blocks and restyles them.',
  'settings.editor.pick': 'Pick an element',
  'settings.editor.done': 'Done',
  'settings.editor.hide': 'Hidden',
  'settings.editor.restore': 'Restore',
  'settings.editor.removeRule': 'Delete the rule for this element',
  'settings.editor.hidden': 'Hidden',
  'settings.editor.hiddenEmpty': 'Nothing is hidden. Double-click an element to hide it.',
  'settings.editor.hiddenHint': 'Click to locate, double-click to restore',
  'settings.editor.side.none': 'Click any element in the picture to see its tag, selector and style.',
  'settings.editor.side.hide': 'Hidden',
  'settings.editor.side.name': 'Name',
  'settings.editor.side.attrName': 'Attribute',
  'settings.editor.side.style': 'Style',
  'settings.editor.side.attrs': 'Attributes',
  'settings.editor.side.value': 'Value',
  'settings.editor.side.add': 'Add',
  'settings.editor.side.remove': 'Remove',
  'settings.editor.side.ruleNote': 'Changes are stored per selector and apply to the same element in a capture.',
  'settings.editor.preset.dim': 'Dim',
  'settings.editor.preset.mark': 'Outline',
  'settings.editor.preset.tight': 'Tight',
  'settings.editor.preset.plain': 'No fill',
  'settings.editor.preset.mono': 'Monospace',
  'settings.editor.preset.small': 'Smaller',
  'settings.editor.library': 'Library',
  'settings.editor.tokensHint': 'Insert a variable',
  'settings.editor.zone.top': 'Top',
  'settings.editor.zone.bottom': 'Bottom',
  'settings.editor.align.left': 'Left',
  'settings.editor.align.center': 'Center',
  'settings.editor.block.text': 'Text',
  'settings.editor.block.textHint': 'Type anything; {turns} and friends become real values',
  'settings.editor.block.size': 'Size',
  'settings.editor.block.align': 'Align',
  'settings.editor.block.height': 'Height',
  'settings.editor.block.width': 'Width',
  'settings.editor.block.image': 'Image',
  'settings.editor.block.imagePick': 'Choose an image',
  'settings.editor.block.imageChange': 'Replace',
  'settings.editor.block.imageHint': 'Drag to place, or pick an image in the panel',
  'settings.editor.block.save': 'Save as component',
  'settings.editor.block.saveName': 'Component name',
  'settings.editor.block.delete': 'Delete',
  'settings.editor.block.toTop': 'Move to top',
  'settings.editor.block.toBottom': 'Move to bottom',
  'settings.editor.block.dropCustom': 'Save as a custom component',
  'settings.editor.block.customFull': 'Custom components are full.',
  'settings.editor.block.zoneHint': 'Drag a content block here to reorder',
  'settings.editor.block.dragHint': 'Drag into the picture to place',
  'settings.editor.block.divider': 'Divider',
  'settings.editor.block.spacer': 'Spacer',
  'settings.editor.block.meta': 'Meta line',
  'settings.editor.block.sizeTitle': 'Title',
  'settings.editor.block.sizeSubtitle': 'Subtitle',
  'settings.editor.block.sizeBody': 'Body',
  'settings.piece.nav': 'Turn navigator',
  'settings.piece.attachments': 'Attachment strip',
  'settings.piece.process': 'Thinking and tool steps',
  'settings.piece.clock': 'Clock and action row',
  'settings.piece.toBottom': 'Back-to-bottom button',
  'settings.piece.handles': 'Drag handles and spacers',
  'settings.piece.paging': 'Load-earlier control',
  'settings.piece.composer': 'Composer',

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
