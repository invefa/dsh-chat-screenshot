/**
 * The settings section: where the picture is described, and the door into the surface that draws it.
 *
 * The section no longer draws a stand-in of its own. What the picture contains is decided on the
 * picture — in the conversation's own place, where every piece the capture can hold is already laid
 * out — so the rows here are the three that have no element to click (alignment, margin, resolution)
 * and the reset. One description of the state, in the place the state applies to.
 */

import { EDGE_CHOICES, SCALE_CHOICES, SCROLL_ATTRIBUTE } from '../shell/const.js'
import { resetOptions, useOptions, writeOptions } from '../shell/options.js'
import { native, h, react, useMemo, useState } from '../shell/runtime.js'
import { useTranslate } from '../shell/i18n.js'
import { openEditor } from './editor/surface.js'

/** Whether a conversation is mounted, so the door can say why it is closed. */
function conversationReady() {
  if (typeof document === 'undefined') return false
  const scroller = document.querySelector(`[${SCROLL_ATTRIBUTE}]`)
  return scroller instanceof Element ? scroller.clientWidth > 0 : false
}

/** One setting, with the host's own selector behind a button. */
function MenuRow({ title, description, value, entries, onSelect }) {
  const [open, setOpen] = useState(false)
  const anchorRef = react.useRef(null)
  const selected = entries.find((entry) => entry.id === value)
  const label = selected === undefined ? value : selected.label
  if (native === undefined) {
    return h(
      'div',
      { className: 'cs-set-row' },
      h(
        'div',
        { className: 'cs-set-text' },
        h('div', { className: 'cs-set-label' }, title),
        h('div', { className: 'cs-set-desc' }, description),
      ),
      h(
        'select',
        {
          className: 'cs-set-select',
          value,
          onChange: (event) => onSelect(event.target.value),
        },
        entries.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.label)),
      ),
    )
  }
  const { Button, Menu } = native
  return h(
    'div',
    { className: 'cs-set-row' },
    h(
      'div',
      { className: 'cs-set-text' },
      h('div', { className: 'cs-set-label' }, title),
      h('div', { className: 'cs-set-desc' }, description),
    ),
    h(
      'div',
      { className: 'cs-set-picker', ref: anchorRef },
      h(
        Button,
        {
          variant: 'outline',
          size: 'sm',
          onClick: () => setOpen((value2) => !value2),
        },
        label,
      ),
      h(Menu, {
        open,
        anchorRef,
        items: entries,
        selectedId: value,
        align: 'end',
        side: 'bottom',
        onSelect: (id) => {
          setOpen(false)
          onSelect(id)
        },
        onClose: () => setOpen(false),
      }),
    ),
  )
}

export function SettingsSection(props) {
  const t = useTranslate()
  const options = useOptions()
  const ready = useMemo(() => conversationReady(), [])

  // The surface covers the conversation, so it cannot stand over this dialog: the dialog steps aside
  // first, and the surface then owns the screen at its own layer.
  const open = () => {
    if (typeof props.close === 'function') props.close()
    openEditor()
  }

  const edgeEntries = EDGE_CHOICES.map((choice) => ({
    id: String(choice),
    label:
      choice === EDGE_CHOICES[0]
        ? t('settings.edge.tight')
        : choice === EDGE_CHOICES[EDGE_CHOICES.length - 1]
          ? t('settings.edge.loose')
          : t('settings.edge.normal'),
  }))
  const currentEdge = String(options.edge)

  return h(
    'div',
    { className: 'cs-set' },
    h('div', { className: 'cs-set-intro' }, t('settings.intro')),
    h(
      'div',
      { className: 'cs-set-open' },
      native === undefined
        ? null
        : h(
            native.Button,
            { variant: 'primary', size: 'sm', disabled: !ready, onClick: () => open() },
            t('settings.editor.open'),
          ),
      ready ? null : h('div', { className: 'cs-set-desc' }, t('settings.editor.noConversation')),
      h('div', { className: 'cs-set-desc' }, t('settings.editor.hint')),
    ),
    h(
      'div',
      { className: 'cs-set-group' },
      h(
        MenuRow,
        {
          title: t('settings.layout.align'),
          description: t('settings.layout.alignHint'),
          value: options.align,
          entries: [
            { id: 'left', label: t('settings.align.left') },
            { id: 'center', label: t('settings.align.center') },
          ],
          onSelect: (id) => writeOptions({ align: id }),
        },
      ),
      h(MenuRow, {
        title: t('settings.layout.edge'),
        description: t('settings.layout.edgeHint'),
        value: currentEdge,
        entries: edgeEntries,
        onSelect: (id) => writeOptions({ edge: Number(id) }),
      }),
      h(MenuRow, {
        title: t('settings.layout.scale'),
        description: t('settings.layout.scaleHint'),
        value: options.scale,
        entries: [
          { id: 'auto', label: t('settings.scale.auto') },
          { id: SCALE_CHOICES[1], label: t('settings.scale.x1') },
          { id: SCALE_CHOICES[2], label: t('settings.scale.x2') },
          { id: SCALE_CHOICES[3], label: t('settings.scale.x3') },
        ],
        onSelect: (id) => writeOptions({ scale: id }),
      }),
    ),
    h(
      'div',
      { className: 'cs-set-foot' },
      h(
        'div',
        { className: 'cs-set-desc' },
        t('settings.resetHint'),
      ),
      h(
        'button',
        { type: 'button', className: 'cs-set-reset', onClick: () => resetOptions() },
        t('settings.reset'),
      ),
    ),
  )
}
