/**
 * The surfaces the capture entry raises: the right-click menu and the turn chooser.
 *
 * Both are the host's own components, taken from the platform seed module, so they inherit the
 * application's styling, keyboard handling, focus trap and portal behaviour instead of imitating it.
 * When an older host does not seed that module, `native` is undefined and both surfaces render
 * nothing: the plain click on the entry still captures the whole conversation.
 */

import { h, native, useEscapeToClose } from '../shell/runtime.js'

/** The host menu, or nothing when the host has no seed module to draw it with. */
export function CaptureMenu({ open, anchorRef, items, onSelect, onClose }) {
  useEscapeToClose(open === true, onClose)
  if (native === undefined) return null
  return h(native.Menu, {
    open,
    anchorRef,
    side: 'top',
    align: 'start',
    portal: true,
    items,
    onSelect,
    onClose,
  })
}

/**
 * The turn chooser: one checkbox row per turn, keyed by the user message that opens it, with the
 * host's modal frame around them.
 * @param props.turns - `turnList(root)` entries, in reading order.
 * @param props.picked - indexes currently selected.
 */
export function TurnPicker({ open, turns, picked, onToggle, onCancel, onConfirm, t }) {
  if (native === undefined) return null
  const footer = [
    h(native.Button, { key: 'cancel', variant: 'ghost', onClick: onCancel }, t('menu.cancel')),
    h(
      native.Button,
      { key: 'confirm', variant: 'primary', disabled: picked.length === 0, onClick: onConfirm },
      t('menu.confirm', { turns: picked.length }),
    ),
  ]
  const rows = turns.map((turn, index) =>
    h(native.Checkbox, {
      key: index,
      checked: picked.includes(index),
      onChange: (on) => onToggle(index, on),
      label: turn.label === '' ? t('menu.turn', { index: index + 1 }) : `${index + 1}. ${turn.label}`,
    }),
  )
  return h(
    native.Modal,
    {
      open,
      onClose: onCancel,
      title: t('menu.pickTitle'),
      closeLabel: t('menu.cancel'),
      footer,
      className: 'cs-pick',
    },
    h('p', { className: 'cs-pick-hint' }, t('menu.pickHint')),
    h('div', { className: 'cs-pick-list' }, rows),
  )
}
