/**
 * The words this surface prints: the built-in names, the preset names, and the one-line summary of
 * an element. They live apart from the component so the inspector and the palette can share them.
 */
import { describeElement } from '../../dom/clone/rules.js'
import { readOptions, ruleFor } from '../../shell/options.js'

export function pieceLabel(t, id) {
  if (id === 'nav') return t('settings.piece.nav')
  if (id === 'attachments') return t('settings.piece.attachments')
  if (id === 'process') return t('settings.piece.process')
  if (id === 'clock') return t('settings.piece.clock')
  if (id === 'toBottom') return t('settings.piece.toBottom')
  if (id === 'handles') return t('settings.piece.handles')
  if (id === 'paging') return t('settings.piece.paging')
  if (id === 'composer') return t('settings.piece.composer')
  return id
}

/** One style preset, named by translation. */
export function presetLabel(t, id) {
  if (id === 'dim') return t('settings.editor.preset.dim')
  if (id === 'mark') return t('settings.editor.preset.mark')
  if (id === 'tight') return t('settings.editor.preset.tight')
  if (id === 'plain') return t('settings.editor.preset.plain')
  if (id === 'mono') return t('settings.editor.preset.mono')
  if (id === 'small') return t('settings.editor.preset.small')
  return id
}

/** A piece option ("hideClock") and its piece id ("clock") name the same part. */
export function pieceOfOption(option) {
  const bare = option.startsWith('hide') ? option.slice(4) : option
  return bare.charAt(0).toLowerCase() + bare.slice(1)
}

/** The name of one hidden entry: a saved rule's name, or the built-in piece's label. */
export function entryLabel(t, entry) {
  const rule = ruleFor(readOptions(), entry.selector)
  const name = rule === null ? entry.name : rule.name
  const label = name === '' ? '' : name
  if (entry.kind === 'piece') return pieceLabel(t, pieceOfOption(entry.option))
  return label === '' ? entry.selector : label
}

/** The block kinds the palette offers, with the label and a one-line description of each. */
export function kindLabel(t, kind) {
  if (kind === 'text') return t('settings.editor.block.text')
  if (kind === 'spacer') return t('settings.editor.block.spacer')
  if (kind === 'image') return t('settings.editor.block.image')
  if (kind === 'divider') return t('settings.editor.block.divider')
  if (kind === 'meta') return t('settings.editor.block.meta')
  return kind
}

/** The alignment names a text block offers. */
export function alignLabel(t, align) {
  if (align === 'center') return t('settings.editor.align.center')
  return t('settings.editor.align.left')
}

/** The two zones, named. */
export function zoneLabel(t, zone) {
  if (zone === 'top') return t('settings.editor.zone.top')
  return t('settings.editor.zone.bottom')
}

/** The size names a text block offers. */
export function sizeLabel(t, size) {
  if (size === 'title') return t('settings.editor.block.sizeTitle')
  if (size === 'subtitle') return t('settings.editor.block.sizeSubtitle')
  return t('settings.editor.block.sizeBody')
}

/**
 * The element under the pointer, as a line the inspector can print: the opening tag with its own
 * markers, then the start of its text. Punctuation and numbers only, so the line reads the same in
 * every language; the count of children is left out because a trailing digit reads as another field.
 */
export function describeSelected(scope, selector) {
  if (scope === null || scope === undefined) return null
  const node = scope.querySelector(selector)
  if (node === null) return null
  const info = describeElement(node)
  const attrs = Object.entries(info.attrs)
    .map(([name, value]) => (value === '' ? name : `${name}="${value}"`))
    .join(' ')
  const head = attrs === '' ? `<${info.tag}>` : `<${info.tag} ${attrs}>`
  return `${head} | ${info.text === '' ? '-' : info.text}`
}

