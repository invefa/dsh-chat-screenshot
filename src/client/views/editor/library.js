/**
 * The palette: the five built-in shapes, the components the user saved, and the variables a text
 * block can print. Every entry is draggable and also clickable, so it works without a mouse.
 */
import { h } from '../../shell/runtime.js'
import { MAX_CUSTOM, TEMPLATE_TOKENS } from '../../shell/const.js'
import { kindLabel } from './labels.js'
import { BLOCK_PAYLOAD } from './drag.js'

/**
 * Build the palette.
 * @param props - t, options, blockSelection, onAdd(kind, shape), onDropCustom(id), onToken(name),
 *   onDrag(payload), onNewComponent(), onEditComponent(id).
 */
export function libraryView(props) {
  const { t, options, blockSelection, onAdd, onDrag, onToken, onDropCustom, onNewComponent, onEditComponent } = props
  const library = h(
    'div',
    { className: 'cs-ed-lib' },
    h(
      'div',
      { className: 'cs-ed-lead-row' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.library')),
      h(
        'button',
        { type: 'button', className: 'cs-ed-newcmp', onClick: () => onNewComponent() },
        '+ ' + t('settings.editor.component.new'),
      ),
    ),
    h(
      'div',
      { className: 'cs-ed-chips' },
      ...['text', 'spacer', 'image', 'divider', 'meta'].map((kind) =>
        h(
          'button',
          {
            key: kind,
            type: 'button',
            className: 'cs-ed-add',
            draggable: 'true',
            title: t('settings.editor.block.dragHint'),
            onDragStart: (event) => {
              onDrag({ id: null, block: { kind } })
              if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
                event.dataTransfer.effectAllowed = 'copy'
                try {
                  event.dataTransfer.setData(BLOCK_PAYLOAD, JSON.stringify({ kind }))
                } catch {
                  // Same as above: the module-level payload is what the drop reads.
                }
              }
            },
            onDragEnd: () => {
              onDrag(null)
            },
            onClick: () => onAdd(kind),
          },
          kindLabel(t, kind),
        ),
      ),
    ),
    options.custom.length === 0
      ? null
      : h(
          'div',
          { className: 'cs-ed-customs' },
          ...options.custom.map((entry) =>
            h(
              'span',
              { key: entry.id, className: 'cs-ed-add cs-ed-add-custom' },
              h(
                'span',
                {
                  className: 'cs-ed-add-name',
                  draggable: 'true',
                  title: t('settings.editor.block.dragHint'),
                  onDragStart: (event) => {
                    onDrag({ id: null, block: entry.block })
                    if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
                      event.dataTransfer.effectAllowed = 'copy'
                      try {
                        event.dataTransfer.setData(BLOCK_PAYLOAD, JSON.stringify({ kind: entry.block.kind }))
                      } catch {
                        // The module-level payload is authoritative.
                      }
                    }
                  },
                  onDragEnd: () => {
                    onDrag(null)
                  },
                  onClick: () => onAdd(entry.block.kind, entry.block),
                },
                entry.name,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'cs-ed-x',
                  title: t('settings.editor.component.edit'),
                  onClick: () => onEditComponent(entry.id),
                },
                '...',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'cs-ed-x',
                  title: t('settings.editor.block.dropCustom'),
                  onClick: () => onDropCustom(entry.id),
                },
                '×',
              ),
            ),
          ),
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
            disabled: blockSelection === null || blockSelection.kind !== 'text',
            onClick: () => onToken(name),
          },
          `{${name}}`,
        ),
      ),
    ),
    options.custom.length >= MAX_CUSTOM ? h('div', { className: 'cs-ed-hintline' }, t('settings.editor.block.customFull')) : null,
  )

  return library
}

