/**
 * The component designer. A component is one block plus a name, so anything a block can be a component
 * can be, and the designer, the shelf and the finished picture all go through the same renderer: what
 * the designer shows is the block as the picture will show it.
 *
 * Every field is rendered as its own component — the menus included — because a menu keeps state of
 * its own. Calling a component as a plain function would put that state on whichever component happens
 * to be rendering, and a field that comes and goes with the block kind would then change how many
 * hooks that component calls.
 */
import { h, useEffect, useRef } from '../../shell/runtime.js'
import { BLOCK_KINDS, BLOCK_NAME_CHARS, BLOCK_TEXT_CHARS, IMAGE_WIDTH_MAX, IMAGE_WIDTH_MIN, SPACER_MAX, SPACER_MIN, TEXT_SIZES } from '../../shell/const.js'
import { renderBlock } from '../../dom/clone/inserts.js'
import { tokenValues } from '../../dom/clone/tokens.js'
import { alignLabel, kindLabel, sizeLabel } from './labels.js'
import { menuRow } from './rows.js'

const ALIGNS = ['left', 'center']

/** Read a file into a data URL, which is the only kind of image a picture can carry. */
function readImage(file, done) {
  const reader = new FileReader()
  reader.addEventListener('load', () => done(typeof reader.result === 'string' ? reader.result : ''))
  reader.addEventListener('error', () => done(''))
  reader.readAsDataURL(file)
}

/**
 * Build the designer.
 * @param props - t, Menu, Button, draft ({ id, name, block, builtin }), onChange(patch), onSave(),
 *   onDelete(), onCancel().
 */
export function componentEditor(props) {
  const { t, Menu, Button, draft, onChange, onSave, onDelete, onCancel } = props
  const previewRef = useRef(null)
  const fileRef = useRef(null)
  const block = draft.block

  useEffect(() => {
    const host = previewRef.current
    if (host === null || host === undefined) return
    const doc = host.ownerDocument
    const drawn = renderBlock(doc, block, tokenValues(doc), null)
    if (drawn === null) {
      const note = doc.createElement('div')
      note.className = 'cs-ed-hintline'
      note.textContent = t('settings.editor.component.previewEmpty')
      host.replaceChildren(note)
      return
    }
    host.replaceChildren(drawn)
  }, [block.kind, block.text, block.size, block.align, block.height, block.width, block.src])

  const setBlock = (patch) => onChange({ block: { ...block, ...patch } })

  const fields = []

  if (block.kind === 'text') {
    fields.push(
      // Every field carries its own label: the designer edits one block, so a bare number box would
      // leave the reader guessing what it measures.
      h(
        'label',
        { key: 'text', className: 'cs-ed-field-row' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.block.text')),
        h('textarea', {
          className: 'cs-ed-area',
          rows: 3,
          maxLength: BLOCK_TEXT_CHARS,
          placeholder: t('settings.editor.block.textHint'),
          value: block.text,
          onChange: (event) => setBlock({ text: event.target.value }),
        }),
      ),
      h(menuRow, {
        key: 'size',
        Menu,
        Button,
        label: t('settings.editor.block.size'),
        value: block.size,
        values: TEXT_SIZES,
        name: (size) => sizeLabel(t, size),
        onSelect: (size) => setBlock({ size }),
      }),
      h(menuRow, {
        key: 'align',
        Menu,
        Button,
        label: t('settings.editor.block.align'),
        value: block.align,
        values: ALIGNS,
        name: (align) => alignLabel(t, align),
        onSelect: (align) => setBlock({ align }),
      }),
    )
  }

  if (block.kind === 'spacer') {
    fields.push(
      h(
        'label',
        { key: 'height', className: 'cs-ed-field-row' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.block.height')),
        h('input', {
          className: 'cs-ed-input',
          type: 'number',
          min: SPACER_MIN,
          max: SPACER_MAX,
          value: block.height,
          onChange: (event) => setBlock({ height: Number(event.target.value) }),
        }),
      ),
    )
  }

  if (block.kind === 'image') {
    fields.push(
      // A file input cannot be styled and reads as an empty box, so the button is the control and the
      // input stays out of sight behind it.
      h(
        'div',
        { key: 'file', className: 'cs-ed-row' },
        h(
          Button,
          { variant: 'outline', size: 'sm', onClick: () => fileRef.current?.click() },
          block.src === '' ? t('settings.editor.block.imagePick') : t('settings.editor.block.imageChange'),
        ),
        h('input', {
          ref: fileRef,
          type: 'file',
          accept: 'image/*',
          className: 'cs-ed-file',
          onChange: (event) => {
            const file = event.target.files === null ? null : event.target.files[0]
            if (file === null || file === undefined) return
            readImage(file, (src) => setBlock({ src }))
          },
        }),
      ),
      h(
        'label',
        { key: 'width', className: 'cs-ed-field-row' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.block.width')),
        h('input', {
          className: 'cs-ed-input',
          type: 'number',
          min: IMAGE_WIDTH_MIN,
          max: IMAGE_WIDTH_MAX,
          value: block.width,
          onChange: (event) => setBlock({ width: Number(event.target.value) }),
        }),
      ),
    )
  }

  if (block.kind === 'divider' || block.kind === 'meta') {
    fields.push(h('div', { key: 'note', className: 'cs-ed-hintline' }, kindLabel(t, block.kind)))
  }

  const canSave = draft.name.trim() !== '' && (block.kind !== 'image' || (typeof block.src === 'string' && block.src !== ''))

  return h(
    'div',
    { className: 'cs-ed-cmp' },
    h('div', { className: 'cs-ed-panel-head' }, draft.builtin === true ? t('settings.editor.component.copy') : t('settings.editor.component.title')),
    draft.builtin === true ? h('div', { className: 'cs-ed-hintline' }, t('settings.editor.component.copyHint')) : null,
    h(
      'div',
      { className: 'cs-ed-row' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.component.name')),
      h('input', {
        className: 'cs-ed-input',
        maxLength: BLOCK_NAME_CHARS,
        placeholder: t('settings.editor.component.namePlaceholder'),
        value: draft.name,
        onChange: (event) => onChange({ name: event.target.value }),
        // A copy arrives with a suggested name. Typing should replace the suggestion, not extend it.
        onFocus: (event) => event.currentTarget.select(),
      }),
    ),
    h(menuRow, {
      key: 'kind',
      Menu,
      Button,
      label: t('settings.editor.component.kind'),
      value: block.kind,
      values: BLOCK_KINDS,
      name: (kind) => kindLabel(t, kind),
      onSelect: (kind) => setBlock({ kind }),
    }),
    ...fields,
    h(
      'div',
      { className: 'cs-ed-cmp-preview' },
      h('div', { className: 'cs-ed-panel-head' }, t('settings.editor.component.preview')),
      h('div', { className: 'cs-ed-cmp-stage', ref: previewRef }),
    ),
    h('div', { className: 'cs-ed-hintline' }, t('settings.editor.component.hint')),
    h(
      'div',
      { className: 'cs-ed-cmp-actions' },
      h(Button, { variant: 'primary', size: 'sm', disabled: !canSave, onClick: onSave }, t('settings.editor.component.save')),
      h(Button, { variant: 'ghost', size: 'sm', onClick: onCancel }, t('settings.editor.component.cancel')),
      draft.id === null ? null : h(Button, { variant: 'ghost', size: 'sm', onClick: onDelete }, t('settings.editor.component.delete')),
    ),
  )
}
