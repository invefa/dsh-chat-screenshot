/**
 * What the picture holds, listed by zone.
 *
 * The dock's first tab answers "what is in the picture, and in which order": the two zones, each with
 * the blocks it carries, in the order a capture draws them. A row selects its block for the inspector,
 * and a row's own menu moves the block between zones or drops it. A block cannot be dragged from here —
 * dragging happens on the picture, where the drop position means something.
 */
import { h } from '../../shell/runtime.js'
import { kindLabel } from './labels.js'

/** A row's second line: enough of the block to tell two of them apart. */
function previewOf(t, block) {
  if (block.kind === 'text') {
    const text = String(block.text ?? '').replace(/\s+/g, ' ').trim()
    if (text === '') return t('settings.editor.content.emptyText')
    return text.length > 48 ? `${text.slice(0, 48)}...` : text
  }
  if (block.kind === 'image') return t('settings.editor.block.image')
  if (block.kind === 'spacer') return `${block.height} px`
  // The kind is already printed in the first column, so a divider says how heavy it is and how much
  // room it keeps instead of repeating its own name.
  if (block.kind === 'divider') return `${block.thickness ?? 1} px / ${block.gap ?? 0} px`
  return t('settings.editor.block.meta')
}

function rowView(props) {
  const { t, block, selected, onSelect, onMenu } = props
  return h(
    'div',
    {
      key: block.id,
      className: selected ? 'cs-ed-row-item is-on' : 'cs-ed-row-item',
      onClick: () => onSelect(block.id),
      onContextMenu: (event) => {
        event.preventDefault()
        onSelect(block.id)
        onMenu({ x: event.clientX, y: event.clientY, id: block.id })
      },
    },
    h('span', { className: 'cs-ed-row-kind' }, kindLabel(t, block.kind)),
    h('span', { className: 'cs-ed-row-text' }, previewOf(t, block)),
    h(
      'button',
      {
        type: 'button',
        className: 'cs-ed-row-more',
        title: t('settings.editor.content.more'),
        onClick: (event) => {
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          onSelect(block.id)
          onMenu({ x: Math.round(rect.left), y: Math.round(rect.bottom + 4), id: block.id })
        },
      },
      '...',
    ),
  )
}

export function contentView(props) {
  const { t, options, selection, onSelect, onAddZone } = props
  const zones = [
    { id: 'top', label: t('settings.editor.zone.top') },
    { id: 'bottom', label: t('settings.editor.zone.bottom') },
  ]
  const selectedId = selection !== null && selection.type === 'block' ? selection.id : null
  return h(
    'div',
    { className: 'cs-ed-zones' },
    ...zones.map((zone) => {
      const blocks = options.blocks.filter((block) => block.zone === zone.id)
      return h(
        'div',
        { key: zone.id, className: 'cs-ed-zone' },
        h(
          'div',
          { className: 'cs-ed-zone-head' },
          h('span', { className: 'cs-ed-zone-name' }, zone.label),
          h('span', { className: 'cs-ed-zone-count' }, String(blocks.length)),
          h('button', { type: 'button', className: 'cs-ed-zone-add', onClick: () => onAddZone(zone.id) }, t('settings.editor.content.add')),
        ),
        blocks.length === 0
          ? h('div', { className: 'cs-ed-zone-empty' }, t('settings.editor.content.empty'))
          : h(
              'div',
              { className: 'cs-ed-rows' },
              ...blocks.map((block) =>
                h(rowView, {
                  key: block.id,
                  t,
                  block,
                  selected: block.id === selectedId,
                  onSelect,
                  onMenu: (menu) => props.onRowMenu(menu),
                }),
              ),
            ),
      )
    }),
  )
}
