/**
 * The shelf: one catalogue of components.
 *
 * A component is a name and a block. The plugin ships a few and the reader can save their own, but the
 * shelf lists them as one kind of thing in one list, drawn by one row: drag it onto the picture, click
 * it to place it at the end of the zone the shelf is pointed at, open it in the designer with "...".
 * A shipped component is not deletable and is never edited in place — opening it starts a copy — so
 * the only difference the reader sees is one missing button, not a second way of doing things.
 *
 * The variables a text block can print sit under the components because they are not components: they
 * go into the text of the block that is already selected.
 */
import { h } from '../../shell/runtime.js'
import { BLOCK_ZONES, MAX_CUSTOM, PRESET_COMPONENTS, TEMPLATE_TOKENS } from '../../shell/const.js'
import { canPlace } from '../../shell/options.js'
import { kindLabel, zoneLabel } from './labels.js'
import { menuRow } from './rows.js'
import { BLOCK_PAYLOAD } from './drag.js'

/** One component of the catalogue, whether the plugin ships it or the reader saved it. */
function entryOf(t, component, builtin) {
  return {
    id: component.id,
    name: builtin ? kindLabel(t, component.block.kind) : component.name,
    block: component.block,
    builtin,
  }
}

/** One row: the name places the component, "..." designs it, "x" forgets a saved one. */
function componentRow(props) {
  const { t, entry, editing, onPlace, onEdit, onDelete, onDrag } = props
  const startDrag = (event) => {
    onDrag({ id: null, block: entry.block })
    if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
      event.dataTransfer.effectAllowed = 'copy'
      try {
        event.dataTransfer.setData(BLOCK_PAYLOAD, JSON.stringify({ kind: entry.block.kind }))
      } catch {
        // The module-level payload is what the drop reads, so a refused custom type costs nothing.
      }
    }
  }
  return h(
    'div',
    { key: (entry.builtin ? 'preset:' : 'custom:') + entry.id, className: editing ? 'cs-ed-item is-on' : 'cs-ed-item' },
    h(
      'button',
      {
        type: 'button',
        className: 'cs-ed-item-name',
        draggable: 'true',
        title: t('settings.editor.block.dragHint'),
        onDragStart: startDrag,
        onDragEnd: () => onDrag(null),
        onClick: () => onPlace(entry),
      },
      entry.name,
    ),
    // A shipped component is named after its kind, so printing the kind again would read "text text".
    entry.builtin ? null : h('span', { className: 'cs-ed-item-kind' }, kindLabel(t, entry.block.kind)),
    h(
      'button',
      {
        type: 'button',
        className: 'cs-ed-item-icon',
        title: t('settings.editor.component.edit'),
        onClick: () => onEdit(entry),
      },
      '...',
    ),
    entry.builtin
      ? null
      : h(
          'button',
          {
            type: 'button',
            className: 'cs-ed-item-icon',
            title: t('settings.editor.component.delete'),
            onClick: () => onDelete(entry.id),
          },
          'x',
        ),
  )
}

/**
 * Build the shelf.
 * @param props - t, Button, Menu, options, tokenText (true while a text field is in reach), editingId
 *   (the component open in the designer), zone (where a click places a component), onPlace(entry),
 *   onEdit(entry), onDelete(id), onZone(zone), onToken(name), onNew(), onDrag(payload).
 */
export function libraryView(props) {
  const { t, Button, Menu, options, tokenText, editingId, zone, onPlace, onEdit, onDelete, onZone, onToken, onNew, onDrag } = props
  const presets = PRESET_COMPONENTS.map((component) => entryOf(t, component, true))
  const saved = options.custom.map((component) => entryOf(t, component, false))

  const place = (entry) => {
    // A component that cannot stand on its own opens in the designer instead of placing nothing: an
    // image has no pixels until a file is chosen, and that choice belongs in one place.
    if (canPlace(entry.block)) {
      onPlace(entry)
      return
    }
    onEdit(entry)
  }

  const row = (entry) =>
    h(componentRow, {
      key: (entry.builtin ? 'preset:' : 'custom:') + entry.id,
      t,
      entry,
      editing: editingId !== null && editingId === entry.id,
      onPlace: place,
      onEdit,
      onDelete,
      onDrag,
    })

  return h(
    'div',
    { className: 'cs-ed-lib' },
    h(
      'div',
      { className: 'cs-ed-lead-row' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.library')),
      h('button', { type: 'button', className: 'cs-ed-newcmp', onClick: () => onNew() }, '+ ' + t('settings.editor.component.new')),
    ),
    h(menuRow, {
      key: 'zone',
      Menu,
      Button,
      label: t('settings.editor.library.zone'),
      value: zone,
      values: BLOCK_ZONES,
      name: (value) => zoneLabel(t, value),
      onSelect: onZone,
    }),
    h(
      'div',
      { className: 'cs-ed-group' },
      h('div', { className: 'cs-ed-group-name' }, t('settings.editor.library.presets')),
      ...presets.map((entry) => row(entry)),
    ),
    h(
      'div',
      { className: 'cs-ed-group' },
      h('div', { className: 'cs-ed-group-name' }, t('settings.editor.library.mine')),
      saved.length === 0
        ? h('div', { className: 'cs-ed-hintline' }, t('settings.editor.library.none'))
        : saved.map((entry) => row(entry)),
    ),
    h('div', { className: 'cs-ed-hintline' }, t('settings.editor.tokensHint')),
    h(
      'div',
      { className: 'cs-ed-chips' },
      ...TEMPLATE_TOKENS.map((name) =>
        h(
          'button',
          {
            key: name,
            type: 'button',
            className: 'cs-ed-token',
            disabled: tokenText !== true,
            onClick: () => onToken(name),
          },
          `{${name}}`,
        ),
      ),
    ),
    saved.length >= MAX_CUSTOM ? h('div', { className: 'cs-ed-hintline' }, t('settings.editor.block.customFull')) : null,
  )
}
