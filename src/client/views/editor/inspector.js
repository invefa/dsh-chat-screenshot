/**
 * The two inspectors of the edit surface: one element of the copy, or one content block.
 *
 * Both are pure. The state they edit and the callbacks that write it arrive as props, so the surface
 * decides what a change means and these decide only how it looks.
 */
import { h } from '../../shell/runtime.js'
import { RULE_PRESETS, STYLE_PROPS, TEXT_SIZES } from '../../shell/const.js'
import { menuRow } from './rows.js'
import { describeSelected, presetLabel, sizeLabel } from './labels.js'

export function elementInspector(props) {
  const { t, selection, rule, detail, styleKeys, attrKeys, Switch, Button } = props
  return h(
    'div',
    { className: 'cs-ed-side' },
    h(
      'div',
      { className: 'cs-ed-side-head' },
      h('span', { className: 'cs-ed-side-tag' }, selection.tag),
      h('span', { className: 'cs-ed-side-text' }, selection.text),
    ),
    h('div', { className: 'cs-ed-mono' }, selection.selector),
    h(
      'div',
      { className: 'cs-ed-row' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.side.hide')),
      h(Switch, {
        checked: rule !== null && rule.hide === true,
        onChange: () => props.onHide(),
      }),
    ),
    h(
      'label',
      { className: 'cs-ed-field-row' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.side.name')),
      h('input', {
        className: 'cs-ed-input',
        defaultValue: rule === null ? selection.text : rule.name,
        key: `name:${selection.selector}:${rule === null ? '' : rule.name}`,
        onBlur: (event) => props.onRename(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        },
      }),
    ),
    h(
      'div',
      { className: 'cs-ed-presets' },
      ...RULE_PRESETS.map((preset) =>
        h(
          Button,
          { key: preset.id, variant: 'outline', size: 'sm', onClick: () => props.onPreset(preset) },
          presetLabel(t, preset.id),
        ),
      ),
    ),
    h('span', { className: 'cs-ed-label' }, t('settings.editor.side.style')),
    ...styleKeys.map((prop) =>
      h(
        'div',
        { key: `style:${prop}`, className: 'cs-ed-row' },
        h('span', { className: 'cs-ed-prop' }, prop),
        h('input', {
          className: 'cs-ed-input',
          defaultValue: rule.style[prop],
          key: `style:${prop}:${rule.style[prop]}`,
          onBlur: (event) => props.onStyle(prop, event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          },
        }),
        h(
          'button',
          { type: 'button', className: 'cs-ed-x', title: t('settings.editor.side.remove'), onClick: () => props.onStyle(prop, '') },
          '×',
        ),
      ),
    ),
    h(
      'div',
      { className: 'cs-ed-row' },
      h(
        'select',
        {
          className: 'cs-ed-select',
          value: props.draftProp,
          onChange: (event) => props.setDraftProp(event.currentTarget.value),
        },
        ...STYLE_PROPS.map((prop) => h('option', { key: prop, value: prop }, prop)),
      ),
      h('input', {
        className: 'cs-ed-input',
        placeholder: t('settings.editor.side.value'),
        value: props.draftValue,
        onChange: (event) => props.setDraftValue(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key !== 'Enter') return
          props.onStyle(props.draftProp, props.draftValue)
          props.setDraftValue('')
        },
      }),
      h(
        Button,
        {
          variant: 'outline',
          size: 'sm',
          onClick: () => {
            props.onStyle(props.draftProp, props.draftValue)
            props.setDraftValue('')
          },
        },
        t('settings.editor.side.add'),
      ),
    ),
    h('span', { className: 'cs-ed-label' }, t('settings.editor.side.attrs')),
    ...attrKeys.map((name) =>
      h(
        'div',
        { key: `attr:${name}`, className: 'cs-ed-row' },
        h('span', { className: 'cs-ed-prop' }, name),
        h('input', {
          className: 'cs-ed-input',
          defaultValue: rule.attrs[name] === null ? '' : rule.attrs[name],
          key: `attr:${name}:${rule.attrs[name] === null ? '' : rule.attrs[name]}`,
          onBlur: (event) => props.onAttr(name, event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          },
        }),
        h(
          'button',
          { type: 'button', className: 'cs-ed-x', title: t('settings.editor.side.remove'), onClick: () => props.onAttr(name, '') },
          '×',
        ),
      ),
    ),
    h(
      'div',
      { className: 'cs-ed-row' },
      h('input', {
        className: 'cs-ed-input',
        placeholder: t('settings.editor.side.attrName'),
        value: props.draftAttr,
        onChange: (event) => props.setDraftAttr(event.currentTarget.value),
      }),
      h('input', {
        className: 'cs-ed-input',
        placeholder: t('settings.editor.side.value'),
        value: props.draftAttrValue,
        onChange: (event) => props.setDraftAttrValue(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key !== 'Enter') return
          props.onAttr(props.draftAttr, props.draftAttrValue)
          props.setDraftAttrValue('')
        },
      }),
      h(
        Button,
        {
          variant: 'outline',
          size: 'sm',
          onClick: () => {
            props.onAttr(props.draftAttr, props.draftAttrValue)
            props.setDraftAttrValue('')
          },
        },
        t('settings.editor.side.add'),
      ),
    ),
    detail === null ? null : h('div', { className: 'cs-ed-note' }, detail),
    h('div', { className: 'cs-ed-note' }, t('settings.editor.side.ruleNote')),
    h(
      'div',
      { className: 'cs-ed-row' },
      h(
        Button,
        { variant: 'ghost', size: 'sm', onClick: () => props.onRemoveRule() },
        t('settings.editor.removeRule'),
      ),
    ),
  )
}

/** The inspector for one block: its content, its geometry, and the way it leaves again. */
export function blockInspector(props) {
  const { t, block, Button, Menu, fileRef } = props
  const zoneName = block.zone === 'top' ? t('settings.editor.zone.top') : t('settings.editor.zone.bottom')
  const rows = [
    h(
      'div',
      { className: 'cs-ed-side-head' },
      h('span', { className: 'cs-ed-side-tag' }, block.kind),
      h('span', { className: 'cs-ed-side-text' }, zoneName),
    ),
  ]

  if (block.kind === 'text') {
    rows.push(
      h(
        'label',
        { className: 'cs-ed-field-row' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.block.text')),
        h('textarea', {
          className: 'cs-ed-area',
          rows: 3,
          defaultValue: block.text,
          key: `text:${block.id}:${block.text}`,
          placeholder: t('settings.editor.block.textHint'),
          onBlur: (event) => props.onPatch({ text: event.currentTarget.value }),
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
        onSelect: (value) => props.onPatch({ size: value }),
      }),
      h(menuRow, {
        key: 'align',
        Menu,
        Button,
        label: t('settings.editor.block.align'),
        value: block.align,
        values: ['left', 'center'],
        name: (value) => (value === 'center' ? t('settings.editor.align.center') : t('settings.editor.align.left')),
        onSelect: (value) => props.onPatch({ align: value }),
      }),
    )
  }

  if (block.kind === 'spacer') {
    rows.push(
      h(
        'label',
        { className: 'cs-ed-field-row' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.block.height')),
        h('input', {
          className: 'cs-ed-input',
          type: 'number',
          min: '4',
          max: '240',
          defaultValue: String(block.height),
          key: `height:${block.id}:${block.height}`,
          onBlur: (event) => props.onPatch({ height: Number(event.currentTarget.value) }),
        }),
      ),
    )
  }

  if (block.kind === 'image') {
    rows.push(
      h(
        'div',
        { className: 'cs-ed-row' },
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
          onChange: props.onPickImage,
        }),
      ),
      h(
        'label',
        { className: 'cs-ed-field-row' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.block.width')),
        h('input', {
          className: 'cs-ed-input',
          type: 'number',
          min: '10',
          max: '100',
          defaultValue: String(block.width),
          key: `width:${block.id}:${block.width}`,
          onBlur: (event) => props.onPatch({ width: Number(event.currentTarget.value) }),
        }),
      ),
    )
  }

  rows.push(
    h(
      'label',
      { className: 'cs-ed-field-row' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.block.saveName')),
      h(
        'div',
        { className: 'cs-ed-row' },
        h('input', {
          className: 'cs-ed-input',
          placeholder: block.kind,
          value: props.customName,
          onChange: (event) => props.onCustomName(event.currentTarget.value),
        }),
        h(Button, { variant: 'outline', size: 'sm', onClick: () => props.onSaveCustom() }, t('settings.editor.block.save')),
      ),
    ),
    h(
      'div',
      { className: 'cs-ed-row' },
      h(Button, { variant: 'ghost', size: 'sm', onClick: () => props.onRemove() }, t('settings.editor.block.delete')),
    ),
  )

  return h('div', { className: 'cs-ed-side' }, ...rows)
}
